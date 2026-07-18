import { useUnreadStore, unreadKey } from '@/stores/unread'

/**
 * Narrow selector over the unread store for one `(deviceId, jid)` pair.
 * Returns `0` when `deviceId` is null (no scoping device yet — e.g. the
 * DeviceGuard is still showing) so the badge simply does not render. The
 * selector subscribes to one key only, so a bump on a different chat does
 * not re-render this row.
 */
export function useUnreadCount(deviceId: string | null, jid: string): number {
  return useUnreadStore((state) =>
    deviceId === null ? 0 : (state.counts[unreadKey(deviceId, jid)] ?? 0),
  )
}

/**
 * Compact badge label: counts above 99 collapse to "99+" so a flood of unreads
 * does not blow out the `min-w-5` pill. The threshold matches WhatsApp Web.
 */
export function formatUnread(n: number): string {
  return n > 99 ? '99+' : String(n)
}
