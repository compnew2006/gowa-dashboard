import type { ApiRequest } from '@/api/request'
import { toApiError } from '@/lib/api-error'
import { http, results } from '@/lib/http'

const enc = encodeURIComponent

function messageRequest(
  messageId: string,
  action: string,
  json: Record<string, unknown>,
): ApiRequest {
  return { method: 'POST', path: `/message/${enc(messageId)}/${action}`, json }
}

export function reactRequest(messageId: string, payload: { phone: string; emoji: string }) {
  return messageRequest(messageId, 'reaction', payload)
}

export function revokeRequest(messageId: string, payload: { phone: string }) {
  return messageRequest(messageId, 'revoke', payload)
}

export function deleteRequest(messageId: string, payload: { phone: string }) {
  return messageRequest(messageId, 'delete', payload)
}

export function updateRequest(messageId: string, payload: { phone: string; message: string }) {
  return messageRequest(messageId, 'update', payload)
}

export function readRequest(messageId: string, payload: { phone: string }) {
  return messageRequest(messageId, 'read', payload)
}

export function starRequest(messageId: string, payload: { phone: string }) {
  return messageRequest(messageId, 'star', { ...payload, is_starred: true })
}

export function unstarRequest(messageId: string, payload: { phone: string }) {
  return messageRequest(messageId, 'unstar', { ...payload, is_starred: false })
}

export function forwardRequest(
  messageId: string,
  payload: { phone: string; force_reupload?: boolean },
) {
  return messageRequest(messageId, 'forward', payload)
}

export interface DownloadedMedia {
  message_id: string
  media_type: string
  filename: string
  file_path: string
  file_url?: string
  file_size: number
}

/**
 * Fetch a single message's media metadata (`file_path` + `filename` + size).
 *
 * Backend quirk workaround (gowa `/message/<id>/download`): the usecase looks
 * the message row up via the UNSCOPED `GetMessageByID(id)`, then validates
 * `message.ChatJID == phone`. In a linked / companion-device setup the same
 * message id is stored on TWO rows — one per device — and the unscoped lookup
 * non-deterministically returns either:
 *   - the row whose `chat_jid` == the conversation JID we passed (the row the
 *     user is viewing), OR
 *   - the row whose `chat_jid` == the SENDER's device JID (the row stored by
 *     the conversation's owning device, viewing the same message from the
 *     other side).
 * The attribution check then fails ~50% of the time with the misleading
 * envelope string `message <id> does not belong to chat <jid>`. This is a
 * backend bug (the usecase has `GetMessageByIDAndDevice` + `deviceIDFromContext`
 * available but does not wire them up); we cannot fix gowa from here, but the
 * two-row structure is symmetric and deterministic, so a single fallback with
 * `phone = deviceId` covers the other row. One of the two attempts always
 * matches whichever row SQLite returned.
 *
 * The fallback ONLY fires for the specific "does not belong to chat" envelope
 * string — genuine 404 / 403 / network errors surface immediately, unchanged.
 */
export async function downloadMedia(
  messageId: string,
  phone: string,
  deviceId?: string,
): Promise<DownloadedMedia> {
  const headers = deviceId ? { 'X-Device-Id': enc(deviceId) } : undefined
  try {
    return await results<DownloadedMedia>(
      http.get(`/message/${enc(messageId)}/download`, { params: { phone }, headers }),
    )
  } catch (error) {
    // Only retry the multi-device attribution race. Bail on any other error
    // (404, 403, network) so the caller's error handling is unchanged.
    if (!deviceId || deviceId === phone) throw error
    const message = toApiError(error).message
    if (!message.includes('does not belong to chat')) throw error
    // Retry with `phone = deviceId`. For a linked-device conversation the
    // owning device's JID is exactly the OTHER row's `chat_jid`, so this
    // attempt matches the row the backend's unscoped lookup returned.
    return results<DownloadedMedia>(
      http.get(`/message/${enc(messageId)}/download`, {
        params: { phone: deviceId },
        headers,
      }),
    )
  }
}
