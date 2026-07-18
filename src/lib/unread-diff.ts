import type { ChatInfo, MessageInfo } from '@/api/chat'

/**
 * Result of a message-side unread diff. `delta` is the count of new incoming
 * messages since the previous poll, with `0` meaning "nothing to bump".
 * `firstNewIncomingId` is the message id of the earliest new incoming entry —
 * the divider anchor in the conversation view.
 */
export interface UnreadDelta {
  delta: number
  firstNewIncomingId: string | null
}

/**
 * Message-side diff. Counts incoming (`!is_from_me`) messages in
 * `nextMessages` whose `chat_jid` matches `chatJid` and whose `id` is "newer
 * than" `prevTopIncomingId`. String ordering of ids is NOT assumed —
 * `nextMessages` is treated as already chronological, so "newer than" means
 * "appears strictly after the prev-top id in the array, or any incoming id
 * when the prev-top id is null". The earliest new incoming id is returned as
 * the divider anchor.
 *
 * When `isSelected` is true, the conversation is currently being viewed, so
 * no bump applies and the result is `{ delta: 0, firstNewIncomingId: null }`.
 * This is the suppression rule that keeps the badge off the open conversation.
 */
export function computeUnreadDelta(
  prevTopIncomingId: string | null,
  nextMessages: readonly MessageInfo[],
  chatJid: string,
  isSelected: boolean,
): UnreadDelta {
  if (isSelected) return { delta: 0, firstNewIncomingId: null }

  // Locate the previously-seen top incoming id. Messages with a different
  // chat_jid are ignored entirely (the conversation view only shows one chat,
  // but the helper stays pure and defensive against a mixed input).
  let anchorIndex = -1
  if (prevTopIncomingId !== null) {
    for (let i = 0; i < nextMessages.length; i++) {
      const message = nextMessages[i]
      if (message.chat_jid !== chatJid) continue
      if (message.id === prevTopIncomingId) {
        anchorIndex = i
        break
      }
    }
  }

  let delta = 0
  let firstNewIncomingId: string | null = null
  for (let i = 0; i < nextMessages.length; i++) {
    const message = nextMessages[i]
    if (message.chat_jid !== chatJid) continue
    if (message.is_from_me) continue
    // When the prev-top is null (first observation), the caller is expected to
    // have seeded the cursor from the first poll; if it has not, treat every
    // incoming id as new so the divider can light up once on the first poll
    // the user is away for. The anchorIndex === -1 branch handles both cases.
    if (anchorIndex >= 0 && i <= anchorIndex) continue
    delta += 1
    if (firstNewIncomingId === null) firstNewIncomingId = message.id
  }

  return { delta, firstNewIncomingId }
}

/**
 * Chats-side diff. The chat list only sees `ChatInfo` (no per-message
 * records), so the bump is driven by `last_message_time` advancement between
 * polls: a chat whose `last_message_time` changed since the previous poll AND
 * is not currently selected contributes a +1 bump. `prevTimeByJid` is the
 * caller-maintained map of `{ jid -> last_message_time }` from the previous
 * poll.
 *
 * Returns the bumps to apply plus the new cursor map so the caller can write
 * it back to its ref atomically. Chats with a server-supplied `unread_count`
 * field are skipped (their badge is server-driven and the client store must
 * not double-count). Chats seen for the first time seed the cursor without
 * bumping (the latest message may or may not be new since app start, so the
 * conservative choice is to start fresh).
 */
export function computeUnreadDeltaFromChats(
  prevTimeByJid: Record<string, string>,
  chats: readonly ChatInfo[],
  selectedJid: string | null,
): { bumps: Array<{ jid: string; delta: number }>; nextTimeByJid: Record<string, string> } {
  const nextTimeByJid: Record<string, string> = { ...prevTimeByJid }
  const bumps: Array<{ jid: string; delta: number }> = []

  for (const chat of chats) {
    // Always refresh the cursor so the next poll compares against this poll's
    // value, even when we skip the bump (a selected chat that advanced still
    // records its new cursor so re-selecting later does not retroactively bump).
    nextTimeByJid[chat.jid] = chat.last_message_time

    // Server-driven badge: skip the client store so the row does not
    // double-count. The hook in `use-unread-count` prefers the server value,
    // so leaving the store untouched here keeps the two paths in agreement.
    if ('unread_count' in chat) continue

    if (selectedJid !== null && chat.jid === selectedJid) continue

    const prev = prevTimeByJid[chat.jid]
    // First time seeing this jid → seed the cursor, do not bump.
    if (prev === undefined) continue
    if (chat.last_message_time === prev) continue

    bumps.push({ jid: chat.jid, delta: 1 })
  }

  return { bumps, nextTimeByJid }
}
