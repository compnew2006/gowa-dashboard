import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { listChats, type ChatInfo } from '@/api/chat'
import type { RegistryDevice } from '@/api/types'
import { useDevices } from '@/hooks/use-devices'
import { useUnreadBumpFromChats } from '@/hooks/use-unread-bump'
import { mergeDeviceChats, type MergedChatRow, type PerDeviceChats } from '@/lib/multi-device-merge'

const PAGE_SIZE = 50

/**
 * Snapshot of one device's loaded chats, lifted up by `<DeviceChatsQuery>` to
 * the parent registry in `useAllDeviceChats`. `fetchNext` is the device's
 * own `useInfiniteQuery.fetchNextPage` (bound at report time) so the parent's
 * round-robin can drive the next page for any device that still has one.
 */
interface DeviceSnapshot {
  chats: ChatInfo[]
  hasMore: boolean
  status: 'loading' | 'error' | 'ready'
  fetchNext: (() => void) | null
  isFetchingNextPage: boolean
}

function sameChats(a: readonly ChatInfo[], b: readonly ChatInfo[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * One per-device infinite-query owner. This is the Rules-of-Hooks escape
 * hatch for `useAllDeviceChats`: the device count is dynamic, so the parent
 * hook CANNOT call `useInfiniteQuery` in a loop. Instead it renders one
 * `<DeviceChatsQuery>` per connected device (keyed by `device.id`) and lets
 * React's reconciler position each query's hooks stably. Each instance reads
 * its device's chats, dedupes by jid (the same defensive dedupe the
 * single-device list does — polling can briefly land a chat in two pages),
 * and lifts the result up via the `report` callback.
 *
 * Renders nothing — the merged list lives in the parent.
 */
function DeviceChatsQuery({
  device,
  search,
  hasMedia,
  selectedJid,
  report,
}: {
  device: RegistryDevice
  search: string
  hasMedia: boolean
  /**
   * Feature 3 (F2.6): the conversation currently open in the detail pane, so
   * this device's poll can suppress the unread bump for that jid. Threaded
   * from `ChatList`'s `selectedJid` prop. `null` when no conversation is open.
   */
  selectedJid: string | null
  report: (deviceId: string, snapshot: DeviceSnapshot) => void
}) {
  const deviceId = device.id
  const query = useInfiniteQuery({
    // Identical queryKey shape to the single-device ChatList so the cache is
    // shared — toggling back to "This device" after "All devices" is a cache
    // hit with no refetch spinner, and toggling into "All devices" reuses the
    // same cache the global device switcher already warmed.
    queryKey: ['chats', deviceId, { search, hasMedia }],
    queryFn: ({ pageParam }) =>
      listChats(
        {
          search: search || undefined,
          has_media: hasMedia || undefined,
          limit: PAGE_SIZE,
          offset: pageParam,
        },
        // Scope THIS device's read to THIS device — without it, every
        // per-device query inherits the globally-selected X-Device-Id from
        // the axios interceptor and they all fetch the same device's chats,
        // collapsing the merged list to one device's worth of rows.
        deviceId,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.offset + lastPage.data.length < lastPage.pagination.total
        ? lastPage.pagination.offset + lastPage.data.length
        : undefined,
    getPreviousPageParam: () => undefined,
    placeholderData: keepPreviousData,
    // Same 5s poll as the single-device list. refetchIntervalInBackground
    // defaults to false in TanStack v5, so polling pauses when the tab is
    // hidden — identical behavior to the single-device path.
    refetchInterval: 5_000,
  })

  const { data, fetchNextPage, hasNextPage, isLoading, isError, isFetchingNextPage } = query

  const chats = useMemo(() => {
    const seen = new Set<string>()
    return (data?.pages.flatMap((p) => p.data) ?? []).filter((chat) => {
      if (seen.has(chat.jid)) return false
      seen.add(chat.jid)
      return true
    })
  }, [data])

  // Lift the latest snapshot up. The parent's reducer no-ops when content is
  // unchanged (see `sameChats`), so a poll that returns the same data does
  // not churn renders or recompute the merge.
  useEffect(() => {
    report(deviceId, {
      chats,
      hasMore: !!hasNextPage,
      status: isLoading ? 'loading' : isError ? 'error' : 'ready',
      isFetchingNextPage,
      fetchNext: () => {
        void fetchNextPage()
      },
    })
  }, [report, deviceId, chats, hasNextPage, isLoading, isError, fetchNextPage, isFetchingNextPage])

  // Feature 3 (F2.6): feed this device's chats into the unread store on each
  // poll. The bump is keyed on THIS device's id (not the global switcher), so
  // an unread on a chat owned by device B bumps device B's row only.
  useUnreadBumpFromChats(deviceId, chats, selectedJid)

  return null
}

export interface UseAllDeviceChatsResult {
  rows: MergedChatRow[]
  isLoading: boolean
  isFetchingNextPage: boolean
  errors: string[]
  hasNextPage: boolean
  fetchNextPage: () => void
  /**
   * Render-prop: invoke inside the parent's JSX (`{result.DeviceChatsQueries()}`)
   * to mount the per-device `<DeviceChatsQuery>` children that own the
   * `useInfiniteQuery` calls. Returns `null` when no devices are connected.
   * The parent controls when (and whether) these queries are mounted — in
   * single-device mode it never invokes this, so the per-device queries do
   * not fire and the only cost of always calling `useAllDeviceChats` is the
   * `useDevices()` query (already running for the top-bar device switcher).
   */
  DeviceChatsQueries: () => ReactElement | null
}

/**
 * Fan out one `useInfiniteQuery` per connected (`state === 'logged_in'`)
 * device, merge the results with `mergeDeviceChats`, and expose a single
 * `{ rows, isLoading, errors, hasNextPage, fetchNextPage }` API that mirrors
 * what the single-device `ChatList` consumes from its own `useInfiniteQuery`.
 *
 * Rules of Hooks: this hook does NOT call `useInfiniteQuery` directly (the
 * device count is dynamic and loops break hook ordering). Instead it renders
 * one `<DeviceChatsQuery>` child per device through the returned
 * `DeviceChatsQueries` render-prop; each child owns its own query and lifts
 * its result up via the `report` callback into a per-device snapshot
 * registry. The merge is a pure `useMemo` over that registry plus the device
 * list. The hook owns no persistent state — the registry is plain `useState`,
 * not a Zustand store, because the merged list is a pure function of (the
 * device list + the per-device query caches + the filters), all of which are
 * already reactive. A store here would duplicate the query cache.
 *
 * `fetchNextPage` round-robins the connected devices and calls `fetchNext`
 * on the first one that is `ready` and still `hasMore`. After its page lands
 * the snapshot updates and the next call resumes from the same device (if it
 * still has more) or moves on. This is approximate but sufficient — the
 * sentinel-driven IntersectionObserver keeps firing as long as the pure
 * helper's `hasNextPage` stays true.
 */
export function useAllDeviceChats({
  search,
  hasMedia,
  selectedJid,
  selectedDeviceIds,
}: {
  search: string
  hasMedia: boolean
  /**
   * Feature 3 (F2.6): the jid of the conversation currently open in the detail
   * pane, threaded down to each per-device query so its poll can suppress the
   * unread bump for that jid. `null` when no conversation is open.
   */
  selectedJid: string | null
  selectedDeviceIds?: string[]
}): UseAllDeviceChatsResult {
  const devicesQuery = useDevices()
  const devices = useMemo(
    () => {
      const allLogged = (devicesQuery.data ?? []).filter((d) => d.state === 'logged_in')
      if (selectedDeviceIds && selectedDeviceIds.length > 0) {
        return allLogged.filter((d) => selectedDeviceIds.includes(d.id))
      }
      return allLogged
    },
    [devicesQuery.data, selectedDeviceIds],
  )

  const [snapshots, setSnapshots] = useState<Record<string, DeviceSnapshot>>({})
  // Ref mirror so `fetchNextPage` can read the latest snapshots without
  // recreating its callback on every snapshot change.
  const snapshotsRef = useRef(snapshots)
  snapshotsRef.current = snapshots

  const report = useCallback((deviceId: string, snapshot: DeviceSnapshot) => {
    setSnapshots((prev) => {
      const cur = prev[deviceId]
      if (
        cur &&
        cur.status === snapshot.status &&
        cur.hasMore === snapshot.hasMore &&
        cur.isFetchingNextPage === snapshot.isFetchingNextPage &&
        sameChats(cur.chats, snapshot.chats)
      ) {
        return prev
      }
      return { ...prev, [deviceId]: snapshot }
    })
  }, [])

  const merged = useMemo(() => {
    const perDevice: PerDeviceChats[] = devices.map((device) => {
      const snap = snapshots[device.id]
      return {
        deviceId: device.id,
        device,
        chats: snap?.chats ?? [],
        hasMore: snap?.hasMore ?? false,
        status: snap?.status ?? 'loading',
      }
    })
    return mergeDeviceChats(perDevice)
  }, [devices, snapshots])

  // `isLoading` is true while the device list itself is fetching OR while
  // every device's first page is still pending. The moment any device
  // reports `ready` or `error`, we render what we have so a single offline
  // device cannot block the rest of the merged list.
  const isLoading =
    devicesQuery.isLoading ||
    (devices.length > 0 &&
      devices.every((d) => {
        const snap = snapshots[d.id]
        return !snap || snap.status === 'loading'
      }))

  const isFetchingNextPage = useMemo(() => {
    return devices.some((d) => snapshots[d.id]?.isFetchingNextPage)
  }, [devices, snapshots])

  const fetchNextPage = useCallback(() => {
    for (const device of devices) {
      const snap = snapshotsRef.current[device.id]
      if (snap?.status === 'ready' && snap.hasMore && snap.fetchNext) {
        snap.fetchNext()
        return
      }
    }
  }, [devices])

  const DeviceChatsQueries = useCallback((): ReactElement | null => {
    if (devices.length === 0) return null
    return (
      <>
        {devices.map((device) => (
          <DeviceChatsQuery
            key={device.id}
            device={device}
            search={search}
            hasMedia={hasMedia}
            selectedJid={selectedJid}
            report={report}
          />
        ))}
      </>
    )
  }, [devices, search, hasMedia, selectedJid, report])

  return {
    rows: merged.rows,
    isLoading,
    isFetchingNextPage,
    errors: merged.errors,
    hasNextPage: merged.hasNextPage,
    fetchNextPage,
    DeviceChatsQueries,
  }
}
