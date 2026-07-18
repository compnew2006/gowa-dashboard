import { useMemo } from 'react'
import type { MessageInfo } from '@/api/chat'
import { selectRecentMediaBurst } from '@/lib/media-burst'

/**
 * Thin reactive wrapper around `selectRecentMediaBurst`. No timers, no
 * watchers — the gap algorithm walks the messages array only, and the 5-second
 * poll that drives the message query re-runs this on every cycle by handing
 * back a new `messages` array. The dependency is a joined string of message
 * ids (not the array reference) so identity churn on the cached pages does not
 * cause a recomputation, but a real content change (a new id arriving in the
 * burst) does.
 */
export function useMediaBurst(
  messages: readonly MessageInfo[],
  maxGapMs: number,
): ReturnType<typeof selectRecentMediaBurst> {
  const messageIdJoin = useMemo(() => messages.map((m) => m.id).join(','), [messages])
  return useMemo(
    () => selectRecentMediaBurst(messages, maxGapMs),
    // messageIdJoin carries the content signal; maxGapMs carries the picker
    // signal. messages is intentionally omitted — its identity flips on every
    // poll, while messageIdJoin only changes when a new id arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messageIdJoin, maxGapMs],
  )
}
