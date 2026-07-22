import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface CrmUser {
  id: string
  email: string
  fullName: string | null
  workspaceId: string
  roleId: string
  roleName?: string
}

interface AuthState {
  token: string | null
  user: CrmUser | null
  setAuth: (token: string, user: CrmUser) => void
  logout: () => void
}

/**
 * CRM auth session — holds the JWT issued by the NestJS backend at :4000 and
 * the decoded user. Independent of the gowa `useConnection` store: a user can
 * be logged into the CRM without being connected to gowa, and vice versa.
 *
 * Persisted to localStorage so a reload restores the session without a re-login.
 * The axios 401 interceptor (lib/api.ts) calls `logout()` when the JWT expires.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'gowa-ui.auth.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user }) => ({ token, user }),
    },
  ),
)
