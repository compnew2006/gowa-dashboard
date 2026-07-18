import { useEffect, useRef } from 'react'
import type { ChatInfo } from '@/api/chat'
import { computeUnreadDeltaFromChats } from '@/lib/unread-diff'
import { useUnreadStore } from '@/stores/unread'

/**
 * Poll-driven feeder for the unread store. On each change to `chats` (the
 * 5-second `refetchInterval` produces a new array reference when the data
 * changes), diff `last_message_time` per jid against the previously-seen
 * cursor and `bump(deviceId, jid, +1)` for each chat that advanced AND is not
 * the currently-open conversation. Chats carrying a server-supplied
 * `unread_count` are skipped inside `computeUnreadDeltaFromChats` so the
 * server-driven badge and the client store never double-count.
 *
 * Implemented as a `useEffect([chats])` — NOT a TanStack `useInfiniteQuery`
 * `onSuccess` callback, which v5 removed from `useInfiniteQuery`. The effect
 * is safe to re-run on every poll: the diff is a no-op when no chat advanced,
 * and the cursor ref is mutated in place so the next poll compares against the
 * latest observed timestamps.
 *
 * `selectedJid` is the conversation currently open in the detail pane (or
 * `null` when none is). Bumps are suppressed for that jid; its cursor still
 * advances so re-selecting it later does not retroactively bump.
 */
export function useUnreadBumpFromChats(
  deviceId: string | null,
  chats: readonly ChatInfo[],
  selectedJid: string | null,
): void {
  const prevTimeByJidRef = useRef<Record<string, string>>({})

  useEffect(() => {
    // No device scope (e.g. the DeviceGuard is still showing) → nothing to
    // key the bump on. Keep the ref seeded so the moment a device resolves,
    // the first poll does not retroactively bump every chat.
    if (deviceId === null) return
    const { bumps, nextTimeByJid } = computeUnreadDeltaFromChats(
      prevTimeByJidRef.current,
      chats,
      selectedJid,
    )
    prevTimeByJidRef.current = nextTimeByJid
    if (bumps.length === 0) return
    const { bump } = useUnreadStore.getState()
    for (const { jid, delta } of bumps) bump(deviceId, jid, delta)
  }, [deviceId, chats, selectedJid])
}
