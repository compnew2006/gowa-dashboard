import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { toApiError } from '@/lib/api-error'

/**
 * Dedicated axios client for the NestJS CRM backend.
 *
 * Lives separately from `lib/http.ts` (which talks to gowa directly with
 * Basic Auth) — the two backends are independent and should not share state.
 *
 * Base URL: `VITE_CRM_API_URL` (default `http://localhost:4000/api/v1`).
 */
export const api: AxiosInstance = axios.create({
  baseURL: (import.meta.env.VITE_CRM_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1',
  timeout: 30_000,
  withCredentials: true, // accept the httpOnly refresh-token cookie
})

api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState()
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(apiError)
  },
)

/**
 * The NestJS controllers all return `{ code, message, results }` (same envelope
 * shape as gowa). This helper unwraps it so callers get the payload directly.
 * Errors are already normalised by the response interceptor above.
 */
export async function unwrap<T>(request: Promise<AxiosResponse<{ code: string; message: string; results: T }>>): Promise<T> {
  const response = await request
  return response.data.results
}
