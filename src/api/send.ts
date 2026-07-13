import { http, results } from '@/lib/http'

export interface SendResult {
  message_id: string
  status: string
}

function send(path: string, body: object): Promise<SendResult> {
  return results(http.post(path, body))
}

/** Build multipart form data, skipping empty/undefined values. */
function formData(fields: Record<string, string | number | boolean | File | undefined | null>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue
    data.append(key, value instanceof File ? value : String(value))
  }
  return data
}

function sendForm(path: string, data: FormData): Promise<SendResult> {
  return results(http.post(path, data))
}

export interface TextPayload {
  phone: string
  message: string
  reply_message_id?: string
  is_forwarded?: boolean
  duration?: number
}

export function sendText(payload: TextPayload): Promise<SendResult> {
  return send('/send/message', clean(payload))
}

export interface MediaPayload {
  phone: string
  caption?: string
  file?: File
  fileUrl?: string
  reply_message_id?: string
  is_forwarded?: boolean
  duration?: number
}

export function sendImage(
  p: MediaPayload & { view_once?: boolean; compress?: boolean },
): Promise<SendResult> {
  return sendForm(
    '/send/image',
    formData({
      phone: p.phone,
      caption: p.caption,
      image: p.file,
      image_url: p.fileUrl,
      view_once: p.view_once,
      compress: p.compress,
      is_forwarded: p.is_forwarded,
      reply_message_id: p.reply_message_id,
      duration: p.duration,
    }),
  )
}

export function sendFile(p: MediaPayload): Promise<SendResult> {
  return sendForm(
    '/send/file',
    formData({
      phone: p.phone,
      caption: p.caption,
      file: p.file,
      file_url: p.fileUrl,
      reply_message_id: p.reply_message_id,
      is_forwarded: p.is_forwarded,
      duration: p.duration,
    }),
  )
}

export function sendVideo(
  p: MediaPayload & { view_once?: boolean; compress?: boolean; gif_playback?: boolean },
): Promise<SendResult> {
  return sendForm(
    '/send/video',
    formData({
      phone: p.phone,
      caption: p.caption,
      video: p.file,
      video_url: p.fileUrl,
      view_once: p.view_once,
      compress: p.compress,
      gif_playback: p.gif_playback,
      is_forwarded: p.is_forwarded,
      reply_message_id: p.reply_message_id,
      duration: p.duration,
    }),
  )
}

export function sendSticker(p: MediaPayload): Promise<SendResult> {
  return sendForm(
    '/send/sticker',
    formData({ phone: p.phone, sticker: p.file, sticker_url: p.fileUrl, is_forwarded: p.is_forwarded }),
  )
}

export function sendAudio(p: MediaPayload & { ptt?: boolean }): Promise<SendResult> {
  return sendForm(
    '/send/audio',
    formData({
      phone: p.phone,
      audio: p.file,
      audio_url: p.fileUrl,
      ptt: p.ptt,
      reply_message_id: p.reply_message_id,
      is_forwarded: p.is_forwarded,
    }),
  )
}

export function sendContact(payload: {
  phone: string
  contact_name: string
  contact_phone: string
}): Promise<SendResult> {
  return send('/send/contact', clean(payload))
}

export function sendLink(payload: {
  phone: string
  link: string
  caption?: string
}): Promise<SendResult> {
  return send('/send/link', clean(payload))
}

export function sendLocation(payload: {
  phone: string
  latitude: string
  longitude: string
}): Promise<SendResult> {
  return send('/send/location', clean(payload))
}

export function sendPoll(payload: {
  phone: string
  question: string
  options: string[]
  max_answer: number
}): Promise<SendResult> {
  return send('/send/poll', clean(payload))
}

export function sendPresence(payload: { type: string }): Promise<SendResult> {
  return send('/send/presence', payload)
}

export function sendChatPresence(payload: {
  phone: string
  action: string
}): Promise<SendResult> {
  return send('/send/chat-presence', payload)
}

/** Drop undefined/empty optional fields so the server sees only what was set. */
function clean<T extends object>(payload: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === '') continue
    out[key] = value
  }
  return out as T
}
