import { api, unwrap } from '@/lib/api'
import type { CrmUser } from '@/stores/auth'

export interface LoginResponse {
  accessToken: string
  code: string
  message: string
}

export async function login(email: string, password: string): Promise<{ token: string; user: CrmUser }> {
  const res = await api.post<LoginResponse>('/auth/login', { email, password })
  const token = res.data.accessToken
  // Decode the JWT payload to seed the user object (no /me endpoint needed).
  const payload = JSON.parse(atob(token.split('.')[1])) as CrmUser & { sub: string; email: string }
  const user: CrmUser = {
    id: payload.sub,
    email: payload.email,
    fullName: null,
    workspaceId: payload.workspaceId,
    roleId: payload.roleId,
    roleName: payload.roleName,
  }
  return { token, user }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout', {})
  } catch {
    // best-effort — even if the call fails, we clear local state
  }
}

export async function wsTicket(deviceId: string): Promise<string | null> {
  try {
    const ticket = await unwrap<string>(api.post('/auth/ws-ticket', { deviceId }))
    return ticket || null
  } catch {
    return null
  }
}
