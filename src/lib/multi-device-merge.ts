import type { ChatInfo } from '@/api/chat'
import type { RegistryDevice } from '@/api/types'
import { isZeroTime } from '@/lib/format'

/**
 * A device's loaded chats plus its pagination/scroll status. Built per
 * per-device `useInfiniteQuery` in `useAllDeviceChats` and handed to
 * `mergeDeviceChats`. `status === 'loading'` devices contribute no rows
 * (their pages are not yet available); `status === 'error'` devices are
 * excluded from `rows` but listed in `errors` so the list footer can surface
 * the failure without a per-device error card.
 */
export interface PerDeviceChats {
  deviceId: string
  device: RegistryDevice
  chats: ChatInfo[]
  hasMore: boolean
  status: 'loading' | 'error' | 'ready'
}

/**
 * A merged chat row tagged with its owning device. The owning device is the
 * one whose `last_message_time` is the most recent across all devices that
 * carry the same `jid` (see `mergeDeviceChats`).
 */
export interface MergedChatRow {
  chat: ChatInfo
  deviceId: string
  device: RegistryDevice
  /** All device ids that carry this jid, for the row's `title` tooltip. */
  owningDeviceIds: string[]
}

export interface MergedChats {
  rows: MergedChatRow[]
  hasNextPage: boolean
  errors: string[]
}

/**
 * Merge per-device chat lists into a single recency-ordered, deduped stream.
 * The merge is pure: identical inputs produce identical outputs, with no
 * reliance on Array.prototype.sort's stability beyond the explicit tiebreaker
 * on `jid` ascending so the order is fully deterministic across polls.
 *
 * The merge in three steps:
 *
 * 1. Flatten. Concatenate every `ready` device's chats into one array,
 *    tagging each with its source device. `loading` and `error` devices
 *    contribute no rows (their pages are either absent or stale).
 * 2. Dedupe by `jid`. A chat that exists on N devices appears once, tagged
 *    with the device whose `last_message_time` is the most recent — that is
 *    the more useful default for an operator scanning for activity. Ties on
 *    `last_message_time` are broken by `jid` then by insertion order so the
 *    winning device is stable across polls. All device ids that carry the
 *    jid are preserved on the row's `owningDeviceIds` so the row can list
 *    "also on: ..." in its tooltip.
 * 3. Sort by `last_message_time` desc, with zero/null timestamps sorted last
 *    (a freshly-synced contact with no messages is the least interesting row).
 *
 * `hasNextPage` is the OR of all devices' `hasMore` so the sentinel-driven
 * IntersectionObserver in `ChatList` keeps loading until every device is
 * exhausted. `errors` is the list of device ids that failed, in input order,
 * so the footer can say "N device(s) failed to load".
 */
export function mergeDeviceChats(perDevice: readonly PerDeviceChats[]): MergedChats {
  const owningByJid = new Map<string, { row: MergedChatRow; time: number }>()

  for (const deviceBucket of perDevice) {
    if (deviceBucket.status !== 'ready') continue
    for (const chat of deviceBucket.chats) {
      const time = isZeroTime(chat.last_message_time)
        ? Number.NEGATIVE_INFINITY
        : Date.parse(chat.last_message_time)
      const existing = owningByJid.get(chat.jid)
      if (!existing) {
        owningByJid.set(chat.jid, {
          row: {
            chat,
            deviceId: deviceBucket.deviceId,
            device: deviceBucket.device,
            owningDeviceIds: [deviceBucket.deviceId],
          },
          time,
        })
      } else {
        // Keep the row whose device has the more recent activity. Ties fall
        // back to jid (deterministic) then to the device already in the map
        // (insertion-stable) so the winner is identical across polls.
        existing.row.owningDeviceIds.push(deviceBucket.deviceId)
        if (time > existing.time) {
          existing.row.chat = chat
          existing.row.deviceId = deviceBucket.deviceId
          existing.row.device = deviceBucket.device
          existing.time = time
        }
      }
    }
  }

  // Sort newest first. Zero-time chats have `time = -Infinity`, so sorting
  // by `b.time - a.time` puts them last naturally. The `jid` tiebreaker
  // makes the order deterministic when two chats share a timestamp (e.g.
  // contact-synced rows with no messages).
  const ranked = Array.from(owningByJid.values()).sort((a, b) => {
    if (a.time !== b.time) return b.time - a.time
    return a.row.chat.jid < b.row.chat.jid ? -1 : a.row.chat.jid > b.row.chat.jid ? 1 : 0
  })
  const rows = ranked.map((entry) => entry.row)

  return {
    rows,
    hasNextPage: perDevice.some((p) => p.status === 'ready' && p.hasMore),
    errors: perDevice.filter((p) => p.status === 'error').map((p) => p.deviceId),
  }
}
