import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * Composite key for a per-device, per-chat unread counter. The `|` separator
 * is safe because gowa JIDs never contain a pipe (the WhatsApp JID grammar is
 * `[0-9]+@[a-z]+(\.[a-z]+)?` for the local part, and device ids are base
 * filenames/UUIDs without pipes). The single source of truth for the badge
 * until gowa adds an `unread_count` field to `ChatInfo` (see AGENTS.md
 * "Known data gaps").
 */
export function unreadKey(deviceId: string, jid: string): string {
  return `${deviceId}|${jid}`
}

interface UnreadState {
  /** Map of `unreadKey(deviceId, jid)` → unread count. */
  counts: Record<string, number>
  /** Add `delta` to the count (clamped at zero — no negative unreads). */
  bump: (deviceId: string, jid: string, delta: number) => void
  /** Overwrite the count for one key. */
  set: (deviceId: string, jid: string, count: number) => void
  /** Remove the count for one key. No-op when the key is absent. */
  clear: (deviceId: string, jid: string) => void
}

/**
 * Persisted unread counters keyed by `${deviceId}|${jid}`. The store survives
 * chat-list unmounts and is read by both the chat-list row badge and the
 * in-conversation divider (Feature 3). The server-value preference lives in
 * the selector hook (`use-unread-count.ts`): when gowa adds `unread_count` to
 * `ChatInfo`, the hook prefers the server value and the store is bypassed for
 * that row.
 */
export const useUnreadStore = create<UnreadState>()(
  persist(
    (set) => ({
      counts: {},
      bump: (deviceId, jid, delta) =>
        set((state) => {
          const key = unreadKey(deviceId, jid)
          const next = Math.max(0, (state.counts[key] ?? 0) + delta)
          // Drop the entry when the count returns to zero so the persisted map
          // does not grow unbounded across a long session of opens and bumps.
          if (next === 0) {
            if (state.counts[key] === undefined) return state
            const counts = { ...state.counts }
            delete counts[key]
            return { counts }
          }
          return { counts: { ...state.counts, [key]: next } }
        }),
      set: (deviceId, jid, count) =>
        set((state) => {
          const key = unreadKey(deviceId, jid)
          if (count <= 0) {
            if (state.counts[key] === undefined) return state
            const counts = { ...state.counts }
            delete counts[key]
            return { counts }
          }
          return { counts: { ...state.counts, [key]: count } }
        }),
      clear: (deviceId, jid) =>
        set((state) => {
          const key = unreadKey(deviceId, jid)
          if (state.counts[key] === undefined) return state
          const counts = { ...state.counts }
          delete counts[key]
          return { counts }
        }),
    }),
    {
      name: 'gowa-ui.unread.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
