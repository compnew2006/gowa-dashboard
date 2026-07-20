export type WsEventCode =
  | 'LOGIN_SUCCESS'
  | 'LIST_DEVICES'
  | 'DEVICE_REMOVED'
  | 'DEVICE_LOGGED_OUT'
  | 'PASSKEY_REQUEST'
  | 'PASSKEY_CONFIRMATION'
  | 'PASSKEY_ERROR'
  | 'DEVICE_WEBHOOK_UPDATED'
  | 'DEVICE_WEBHOOK_CONFIG_UPDATED'
  // Emitted by the backend whenever a message or reaction is received, so the
  // UI can invalidate its chat-message cache immediately instead of waiting
  // for the 5s poll. The literal value matches the backend constant
  // WsCodeMessageEvent verbatim (ws.ts performs no case transform).
  | 'message.event'

export interface WsEvent {
  code: WsEventCode
  message: string
  result: unknown
}

type Handler = (event: WsEvent) => void

const handlers = new Set<Handler>()

export function onWsEvent(handler: Handler): () => void {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function emitWsEvent(event: WsEvent): void {
  for (const handler of handlers) handler(event)
}
