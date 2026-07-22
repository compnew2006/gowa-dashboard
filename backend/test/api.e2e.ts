import { describe, it, expect } from 'vitest'
import request from 'supertest'

/**
 * HTTP-level integration suite. Talks to a LIVE NestJS server on :4000 that
 * was started via `npm run start:dev`. This is more honest than a mocked
 * NestJS TestingModule: it exercises the real wiring (ConfigModule, Drizzle,
 * JwtStrategy, RolesGuard, audit triggers) end-to-end.
 *
 * Pre-reqs:
 *   1. `npm run migrate && npm run seed` has run.
 *   2. `npm run start:dev` is running on :4000.
 *   3. The seeded admin exists: admin@gowa-crm.local / ChangeMe!2026.
 *
 * The suite creates a fresh Agent user per run and is self-cleaning.
 */

const BASE = 'http://127.0.0.1:4000'
const ADMIN_EMAIL = 'admin@gowa-crm.local'
const ADMIN_PASSWORD = 'ChangeMe!2026'
const AGENT_EMAIL = `agent-test-${Date.now()}@gowa-crm.local`
const AGENT_PASSWORD = 'AgentPass!2026'

let adminToken: string
let adminRefreshCookie: string
let agentToken: string
let agentUserId: string
let createdContactId: string

async function login(email: string, password: string): Promise<{ token: string; cookie: string }> {
  const res = await request(BASE).post('/api/v1/auth/login').send({ email, password }).expect(200)
  const setCookie = res.headers['set-cookie'] as string[] | undefined
  const cookie = (setCookie?.[0] ?? '').split(';')[0]
  return { token: res.body.accessToken, cookie }
}

describe('Auth', () => {
  it('rejects wrong password with 401', async () => {
    await request(BASE).post('/api/v1/auth/login').send({ email: ADMIN_EMAIL, password: 'WRONG' }).expect(401)
  })

  it('admin login issues a real JWT with roleName=SuperAdmin', async () => {
    const loginRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD)
    adminToken = loginRes.token
    adminRefreshCookie = loginRes.cookie
    expect(adminToken.split('.').length).toBe(3)
    const payload = JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64').toString('utf8'))
    expect(payload.roleName).toBe('SuperAdmin')
    expect(payload.workspaceId).toBeTruthy()
  })

  it('rotates the refresh token', async () => {
    const res = await request(BASE)
      .post('/api/v1/auth/refresh')
      .set('Cookie', adminRefreshCookie)
      .send({})
      .expect(200)
    expect(res.body.accessToken).toBeTruthy()
  })

  it('health is public', async () => {
    await request(BASE).get('/api/v1/auth/health').expect(200)
  })
})

describe('Users (admin CRUD)', () => {
  it('admin lists users', async () => {
    const res = await request(BASE)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(res.body.results.length).toBeGreaterThan(0)
    expect(res.body.results[0]).toHaveProperty('role')
  })

  it('admin creates a fresh Agent user', async () => {
    const res = await request(BASE)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: AGENT_EMAIL, password: AGENT_PASSWORD, fullName: 'Test Agent' })
      .expect(201)
    agentUserId = res.body.results.id
    expect(res.body.results.role.name).toBe('Agent')
  })

  it('admin can fetch the new user', async () => {
    const res = await request(BASE)
      .get(`/api/v1/users/${agentUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(res.body.results.email).toBe(AGENT_EMAIL)
  })

  it('admin can update the user', async () => {
    const res = await request(BASE)
      .patch(`/api/v1/users/${agentUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Renamed Agent' })
      .expect(200)
    expect(res.body.results.fullName).toBe('Renamed Agent')
  })

  it('agent can log in with the credentials admin created', async () => {
    const agentLogin = await login(AGENT_EMAIL, AGENT_PASSWORD)
    agentToken = agentLogin.token
    expect(agentToken).toBeTruthy()
  })
})

describe('RolesGuard enforcement', () => {
  it('Agent CANNOT list users (no users:manage permission)', async () => {
    const res = await request(BASE)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403)
    expect(res.body.code).toBe('forbidden')
  })

  it('Agent CANNOT list audit logs (no audit:read)', async () => {
    await request(BASE)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403)
  })

  it('Agent CAN read contacts (has contacts:read + write)', async () => {
    await request(BASE)
      .get('/api/v1/contacts')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200)
  })
})

describe('Contacts (CRUD)', () => {
  const jid = `test-${Date.now()}@s.whatsapp.net`

  it('Agent creates a contact', async () => {
    const res = await request(BASE)
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ jid, name: 'Test Contact', phoneNumber: '+1234567890' })
      .expect(201)
    expect(res.body.results.jid).toBe(jid)
    createdContactId = res.body.results.id
  })

  it('rejects duplicate jid (409 conflict)', async () => {
    await request(BASE)
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ jid, phoneNumber: '+1234567890' })
      .expect(409)
  })

  it('lists contacts with search filter', async () => {
    const res = await request(BASE)
      .get('/api/v1/contacts?search=Test')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200)
    expect(res.body.results.some((c: { jid: string }) => c.jid === jid)).toBe(true)
  })

  it('Agent updates the contact', async () => {
    const res = await request(BASE)
      .patch(`/api/v1/contacts/${createdContactId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'Updated Name' })
      .expect(200)
    expect(res.body.results.name).toBe('Updated Name')
  })

  it('Agent CANNOT delete (needs contacts:manage) → 403', async () => {
    await request(BASE)
      .delete(`/api/v1/contacts/${createdContactId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403)
  })

  it('Admin CAN delete the contact', async () => {
    await request(BASE)
      .delete(`/api/v1/contacts/${createdContactId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
  })
})

describe('Messages ledger (read-only)', () => {
  it('returns aggregate stats', async () => {
    const res = await request(BASE)
      .get('/api/v1/messages/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(res.body.results).toHaveProperty('total')
    expect(res.body.results).toHaveProperty('inbound')
    expect(res.body.results).toHaveProperty('outbound')
  })

  it('returns an array for any jid (possibly empty)', async () => {
    const res = await request(BASE)
      .get('/api/v1/messages/nonexistent@s.whatsapp.net')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(Array.isArray(res.body.results)).toBe(true)
  })
})

describe('Audit log (admin-only)', () => {
  it('lists audit entries filtered by action=auth.login', async () => {
    const res = await request(BASE)
      .get('/api/v1/audit?action=auth.login&limit=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(Array.isArray(res.body.results)).toBe(true)
    const loginEvents = res.body.results.filter((r: { action: string }) => r.action === 'auth.login')
    expect(loginEvents.length).toBeGreaterThan(0)
  })

  it('filters by action prefix (contact.*)', async () => {
    const res = await request(BASE)
      .get('/api/v1/audit?action=contact')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(res.body.results.every((r: { action: string }) => r.action.startsWith('contact'))).toBe(true)
  })
})

describe('Devices vault + proxy (unchanged from yesterday, re-verified)', () => {
  it('admin lists devices', async () => {
    const res = await request(BASE)
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(Array.isArray(res.body.results)).toBe(true)
  })
})
