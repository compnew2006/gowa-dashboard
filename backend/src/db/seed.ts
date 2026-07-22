import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as bcrypt from 'bcryptjs'
import { roles, workspaces, users, workspaceMembers } from './schema'

export const CORE_ROLES = [
  {
    name: 'SuperAdmin',
    permissions: ['*'],
  },
  {
    name: 'Admin',
    permissions: [
      'workspace:manage',
      'users:manage',
      'devices:admin',
      'chats:read',
      'chats:write',
      'contacts:manage',
      'campaigns:manage',
      'audit:read',
    ],
  },
  {
    name: 'Manager',
    permissions: [
      'devices:read',
      'chats:read',
      'chats:write',
      'contacts:manage',
      'campaigns:read',
      'campaigns:write',
    ],
  },
  {
    name: 'Agent',
    permissions: ['chats:read', 'chats:write', 'contacts:read', 'contacts:write'],
  },
]

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env.')
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD
  if (isProduction && (!defaultEmail || !defaultPassword)) {
    throw new Error(
      'DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be set in production (no in-source fallback).',
    )
  }

  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client, { schema: { roles, workspaces, users, workspaceMembers } })

  console.log('Starting database seeding...')

  // 1. Roles (idempotent upsert)
  const seededRoles: Record<string, string> = {}
  for (const roleDef of CORE_ROLES) {
    const [inserted] = await db
      .insert(roles)
      .values({ name: roleDef.name, permissions: roleDef.permissions })
      .onConflictDoUpdate({
        target: roles.name,
        set: { permissions: roleDef.permissions, updatedAt: new Date() },
      })
      .returning({ id: roles.id, name: roles.name })
    if (inserted) seededRoles[inserted.name] = inserted.id
  }
  console.log(`Seeded ${Object.keys(seededRoles).length} roles.`)

  // 2. Default workspace
  const [defaultWorkspace] = await db
    .insert(workspaces)
    .values({ name: 'Default Workspace', slug: 'default-workspace' })
    .onConflictDoUpdate({ target: workspaces.slug, set: { updatedAt: new Date() } })
    .returning({ id: workspaces.id })
  if (!defaultWorkspace) throw new Error('Failed to upsert default workspace.')
  console.log(`Default workspace: ${defaultWorkspace.id}`)

  // 3. Admin user (bcrypt, salt rounds 12)
  const adminEmail = defaultEmail || 'admin@gowa-crm.local'
  const adminPassword = defaultPassword || 'ChangeMe!2026'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const [admin] = await db
    .insert(users)
    .values({
      email: adminEmail,
      passwordHash,
      fullName: 'System Administrator',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, updatedAt: new Date() }, // rotate hash on re-seed
    })
    .returning({ id: users.id })
  if (!admin) throw new Error('Failed to upsert admin user.')
  console.log(`Admin user: ${admin.id} (${adminEmail})`)

  // 4. Bind admin to workspace with SuperAdmin
  const roleId = seededRoles['SuperAdmin'] || seededRoles['Admin']
  if (roleId) {
    await db
      .insert(workspaceMembers)
      .values({ workspaceId: defaultWorkspace.id, userId: admin.id, roleId })
      .onConflictDoNothing()
    console.log('Bound admin -> workspace (SuperAdmin).')
  }

  await client.end()
  console.log('Seeding complete.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
