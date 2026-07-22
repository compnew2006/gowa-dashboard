import { api, unwrap } from '@/lib/api'

export interface CrmUserRow {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  role: { id: string; name: string } | null
}

export interface CreateUserPayload {
  email: string
  password: string
  fullName?: string
  roleId?: string
}

export interface UpdateUserPayload {
  fullName?: string
  avatarUrl?: string
  isActive?: boolean
}

export async function listUsers(): Promise<CrmUserRow[]> {
  return unwrap<CrmUserRow[]>(api.get('/users'))
}

export async function createUser(payload: CreateUserPayload): Promise<CrmUserRow> {
  return unwrap<CrmUserRow>(api.post('/users', payload))
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<CrmUserRow> {
  return unwrap<CrmUserRow>(api.patch(`/users/${id}`, payload))
}

export async function assignRole(id: string, roleId: string): Promise<void> {
  await api.post(`/users/${id}/role`, { roleId })
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`)
}

export interface Role {
  id: string
  name: string
  permissions: string[]
}

/** Roles are seeded by the backend; we read them indirectly via the audit list
 * or expose them here when the backend grows a /roles endpoint. For now we hard-code
 * the four core roles from `backend/src/db/seed.ts` CORE_ROLES so the user-create
 * form can offer them without a separate endpoint. */
export const KNOWN_ROLES: Array<{ id: 'SuperAdmin' | 'Admin' | 'Manager' | 'Agent'; name: string }> = [
  { id: 'SuperAdmin', name: 'SuperAdmin' },
  { id: 'Admin', name: 'Admin' },
  { id: 'Manager', name: 'Manager' },
  { id: 'Agent', name: 'Agent' },
]
