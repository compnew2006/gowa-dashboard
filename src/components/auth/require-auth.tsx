import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

/**
 * Layout route that gates nested CRM routes on a valid JWT.
 * If the user is not authenticated, redirect to /login (preserving the
 * intended destination via `state.from`).
 */
export function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
