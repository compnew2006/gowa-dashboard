import { http, results } from '@/lib/http'
import type { SendResult } from '@/api/send'

const enc = encodeURIComponent

export function reactMessage(messageId: string, payload: { phone: string; emoji: string }) {
  return results<SendResult>(http.post(`/message/${enc(messageId)}/reaction`, payload))
}

export function revokeMessage(messageId: string, payload: { phone: string }) {
  return results<SendResult>(http.post(`/message/${enc(messageId)}/revoke`, payload))
}

export function deleteMessage(messageId: string, payload: { phone: string }) {
  return results<SendResult>(http.post(`/message/${enc(messageId)}/delete`, payload))
}

export function updateMessage(messageId: string, payload: { phone: string; message: string }) {
  return results<SendResult>(http.post(`/message/${enc(messageId)}/update`, payload))
}

export function markRead(messageId: string, payload: { phone: string }) {
  return results<SendResult>(http.post(`/message/${enc(messageId)}/read`, payload))
}

export function starMessage(messageId: string, payload: { phone: string }) {
  return results<SendResult>(
    http.post(`/message/${enc(messageId)}/star`, { ...payload, is_starred: true }),
  )
}

export function unstarMessage(messageId: string, payload: { phone: string }) {
  return results<SendResult>(
    http.post(`/message/${enc(messageId)}/unstar`, { ...payload, is_starred: false }),
  )
}

export function forwardMessage(
  messageId: string,
  payload: { phone: string; force_reupload?: boolean },
) {
  return results<SendResult>(http.post(`/message/${enc(messageId)}/forward`, payload))
}

export interface DownloadedMedia {
  message_id: string
  media_type: string
  filename: string
  file_path: string
  file_url?: string
  file_size: number
}

export function downloadMedia(messageId: string, phone: string) {
  return results<DownloadedMedia>(
    http.get(`/message/${enc(messageId)}/download`, { params: { phone } }),
  )
}
