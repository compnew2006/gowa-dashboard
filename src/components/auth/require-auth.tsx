import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

/**
 * Layout route that gates the whole application (every page under AppShell) on
 * a valid JWT in `useAuthStore`. If the user is not authenticated, redirect to
 * /login. The gowa `useConnection` is no longer a routing gate; an
 * authenticated-but-unconnected user can still browse and sees a non-blocking
 * banner in the shell.
 */
export function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
