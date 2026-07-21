import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { ResponseData } from '@/api/types'
import { basicAuthHeader, toApiError } from '@/lib/api-error'
import { useConnection } from '@/stores/connection'
import { useDeviceStore } from '@/stores/device'

export const http: AxiosInstance = axios.create({ timeout: 45_000, withCredentials: true })

http.interceptors.request.use((config) => {
  const { baseUrl, username, password } = useConnection.getState()
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'
  config.baseURL = baseUrl ? `${baseUrl.replace(/\/+$/, '')}${apiUrl}` : apiUrl
  if (username && password && !config.headers.Authorization) {
    config.headers.Authorization = basicAuthHeader(username, password)
  }
  const deviceId = useDeviceStore.getState().selectedDeviceId
  if (deviceId && !config.headers['X-Device-Id']) {
    config.headers['X-Device-Id'] = encodeURIComponent(deviceId)
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: any) => {
    const originalRequest = error?.config
    const apiError = toApiError(error)

    if (apiError.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => http(originalRequest))
          .catch((err) => Promise.reject(toApiError(err)))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'
        await axios.post(`${apiUrl}/auth/refresh`, {}, { withCredentials: true })
        processQueue(null)
        return http(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        useConnection.getState().markUnauthorized()
        return Promise.reject(apiError)
      } finally {
        isRefreshing = false
      }
    }

    if (apiError.status === 401) {
      useConnection.getState().markUnauthorized()
    }

    return Promise.reject(apiError)
  },
)

/** Unwrap the gowa envelope {code, message, results}. */
export async function results<T>(request: Promise<AxiosResponse<ResponseData<T>>>): Promise<T> {
  const response = await request
  return response.data.results as T
}

export async function envelope<T>(
  request: Promise<AxiosResponse<ResponseData<T>>>,
): Promise<ResponseData<T>> {
  const response = await request
  return response.data
}
