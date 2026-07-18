export const JID_TYPES = {
  user: '@s.whatsapp.net',
  group: '@g.us',
  newsletter: '@newsletter',
  lid: '@lid',
  status: 'status@broadcast',
} as const

export type RecipientType = keyof typeof JID_TYPES

export const recipientOptions: { value: RecipientType; label: string }[] = [
  { value: 'user', label: 'Private message' },
  { value: 'group', label: 'Group' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'lid', label: 'LID (Linked ID)' },
  { value: 'status', label: 'Status' },
]

/** Compose the WhatsApp JID the API expects from a phone/id and recipient type. */
export function composeJid(phone: string, type: RecipientType): string {
  if (type === 'status') return JID_TYPES.status
  const trimmed = phone.trim()
  if (!trimmed) return ''
  if (trimmed.includes('@')) return trimmed
  return `${trimmed}${JID_TYPES[type]}`
}

export function isStatus(type: RecipientType): boolean {
  return type === 'status'
}

/**
 * Reduce a WhatsApp JID to its local-part phone/id. Returns the substring
 * before the first `@`, the whole input when there is no `@`, and the empty
 * string for empty/whitespace-only input. Never throws. This is the named,
 * tested home for the `jid.split('@')[0]` idiom that several list components
 * inline; it exists so the ZIP filename path has one place to call.
 */
export function jidToPhone(jid: string): string {
  if (!jid || !jid.trim()) return ''
  const atIndex = jid.indexOf('@')
  return atIndex === -1 ? jid : jid.slice(0, atIndex)
}
