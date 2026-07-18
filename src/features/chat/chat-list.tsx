import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { listChats, type ChatInfo } from '@/api/chat'
import { ChatAvatar } from '@/features/chat/chat-avatar'
import { Button } from '@/components/ui/button'
import { DeviceSwitcher } from '@/components/layout/device-switcher'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAllDeviceChats } from '@/hooks/use-all-device-chats'
import { useDevices } from '@/hooks/use-devices'
import { useSelectedDevice } from '@/hooks/use-device-guard'
import { formatUnread, useUnreadCount } from '@/hooks/use-unread-count'
import { useUnreadBumpFromChats } from '@/hooks/use-unread-bump'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import type { MergedChatRow } from '@/lib/multi-device-merge'
import { formatDate, isZeroTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

/**
 * Effective unread count for one chat row. Prefers the server-supplied
 * `unread_count` field (the moment gowa adds it to `ChatInfo`, the badge lights
 * up from the server value with no further change); falls back to the
 * client-side poll-driven counter in the unread store. Returns 0 when the
 * device id is null (the DeviceGuard is still showing).
 */
function useEffectiveUnread(deviceId: string | null, chat: ChatInfo): number {
  // The selector hook is called unconditionally so Rules-of-Hooks hold; the
  // server-preference is applied AFTER, in plain branching.
  const clientCount = useUnreadCount(deviceId, chat.jid)
  if ('unread_count' in chat) {
    const serverCount = (chat as ChatInfo & { unread_count?: number }).unread_count
    return typeof serverCount === 'number' ? serverCount : clientCount
  }
  return clientCount
}

/**
 * Trailing unread-count pill. Steel-blue per DESIGN.md's badge-default
 * (`bg-primary text-primary-foreground`), NOT emerald/amber/sky — the
 * Signal-Only rule reserves those for device/WS state, and unread is a content
 * signal, not device state. The number travels with the hue so color is never
 * the only signal. Counts above 99 collapse to "99+" via `formatUnread`.
 *
 * `aria-label` carries the count for screen readers; the span itself is the
 * visible signal. The pill is `shrink-0` so a long name in the row body never
 * squeezes it out of view.
 */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        'bg-primary text-primary-foreground inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums',
      )}
    >
      {formatUnread(count)}
    </span>
  )
}

/**
 * Per-row trailing "device tag" pill shown only in All-devices mode. The pill
 * is a soft steel-blue tint (`bg-primary/10 text-primary`), NOT the solid
 * `bg-primary` of the unread badge — a tag is not a count. The content is the
 * device's `display_name` (the push name) in `font-mono` per DESIGN.md's
 * Mono-for-Identifiers rule (a push name is an operator identifier). The
 * `title` lists every device that carries this jid when the merge deduped
 * multiple owners into one row.
 */
function DeviceTag({ row }: { row: MergedChatRow }) {
  const label = row.device.display_name || row.device.id
  const others = row.owningDeviceIds.filter((id) => id !== row.deviceId)
  const title =
    others.length > 0
      ? `Also on: ${others.join(', ')}`
      : `Device: ${row.device.display_name ?? row.device.id}`
  return (
    <span
      title={title}
      className={cn(
        'bg-primary/10 text-primary inline-flex h-5 max-w-[8rem] shrink-0 items-center truncate rounded-full px-1.5 font-mono text-xs',
      )}
    >
      {label}
    </span>
  )
}

type ChatMode = 'this' | 'all'

export function ChatList({
  selectedJid,
  onSelect,
}: {
  selectedJid: string | null
  /**
   * Widened in Feature 2: the optional `deviceId` carries the row's owning
   * device id in All-devices mode so the conversation pane can scope reads
   * and sends to that device without mutating `useDeviceStore`. Existing
   * single-device callers (This-device mode) ignore it; the call site stays
   * backwards-compatible because the second argument is optional.
   */
  onSelect: (chat: ChatInfo, deviceId?: string) => void
}) {
  const [search, setSearch] = useState('')
  const [hasMedia, setHasMedia] = useState(false)
  const [mode, setMode] = useState<ChatMode>('this')
  const deviceId = useSelectedDevice()
  const devicesQuery = useDevices()

  // Count of connected devices gates the "All devices" toggle: with fewer
  // than two logged_in devices, the merged list is identical to the
  // single-device list, so the option disables with a Tooltip.
  const connectedCount = (devicesQuery.data ?? []).filter((d) => d.state === 'logged_in').length
  const allDevicesDisabled = connectedCount < 2

  // Single-device query path — unchanged from before Feature 2. The cache key
  // matches the per-device key used in `useAllDeviceChats`, so toggling
  // between modes is a cache hit (no refetch spinner).
  const thisDeviceQuery = useInfiniteQuery({
    queryKey: ['chats', deviceId, { search, hasMedia }],
    queryFn: ({ pageParam }) =>
      listChats({
        search: search || undefined,
        has_media: hasMedia || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.offset + lastPage.data.length < lastPage.pagination.total
        ? lastPage.pagination.offset + lastPage.data.length
        : undefined,
    getPreviousPageParam: () => undefined,
    placeholderData: keepPreviousData,
    refetchInterval: deviceId ? 5_000 : false,
    // Only run the single-device query when the user is on This-device mode.
    // In All-devices mode the per-device queries inside useAllDeviceChats
    // own the work (with their own shared cache key).
    enabled: mode === 'this',
  })

  const allDevices = useAllDeviceChats({ search, hasMedia, selectedJid })
  // Mount the per-device query owners when in All-devices mode so the
  // Rules-of-Hooks-compliant children can lift their snapshots up. In
  // This-device mode this renders null and the per-device queries are not
  // mounted, so they do not fire.
  const DeviceChatsQueries = allDevices.DeviceChatsQueries

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Derive the visible list from the active mode so the render path and the
  // sentinel-driven IntersectionObserver share one source of truth.
  const thisDeviceChats = (() => {
    const seen = new Set<string>()
    return (thisDeviceQuery.data?.pages.flatMap((p) => p.data) ?? []).filter((c) => {
      if (seen.has(c.jid)) return false
      seen.add(c.jid)
      return true
    })
  })()

  const isAllMode = mode === 'all'
  const mergedRows = isAllMode ? allDevices.rows : []
  const visibleChats = isAllMode ? mergedRows.map((r) => r.chat) : thisDeviceChats
  const total = isAllMode
    ? mergedRows.length
    : (thisDeviceQuery.data?.pages[0]?.pagination.total ?? 0)
  const isLoading = isAllMode ? allDevices.isLoading : thisDeviceQuery.isLoading
  const isFetchingNextPage = isAllMode ? false : thisDeviceQuery.isFetchingNextPage
  const hasNextPage = isAllMode ? allDevices.hasNextPage : thisDeviceQuery.hasNextPage
  const fetchNextPage = isAllMode ? allDevices.fetchNextPage : thisDeviceQuery.fetchNextPage
  const errors = isAllMode ? allDevices.errors : []

  // Feature 3: feed the single-device poll into the unread store. In
  // All-devices mode this is a no-op (null deviceId + empty chats) — the
  // per-device <DeviceChatsQuery> children own their own bumps keyed on their
  // device id, so an unread on a chat owned by device B bumps only device B's
  // row (F2.6). The hook is called unconditionally so its own internal hooks
  // stay stable across mode toggles.
  useUnreadBumpFromChats(isAllMode ? null : deviceId, isAllMode ? [] : thisDeviceChats, selectedJid)
  // Reveal the polished scrollbar thumb only while scrolling (auto-hides on
  // idle). The hook is side-effect-only and does not interfere with the
  // IntersectionObserver-driven infinite scroll below.
  useChatScroll(scrollRef, [isAllMode])

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { root, rootMargin: '0px 0px 200px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Hidden but mounted: the per-device `useInfiniteQuery` owners that
          lift snapshots into useAllDeviceChats. They render `null`; mounting
          them is what positions their hooks stably (Rules of Hooks). */}
      {isAllMode && <DeviceChatsQueries />}

      <div className="flex flex-col gap-2.5 border-b px-3 pt-3 pb-2.5">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="bg-muted/50 focus-visible:bg-background border-0 pl-9 focus-visible:ring-1"
            placeholder="Search chats"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <DeviceSwitcher
            onValueChange={() => {
              // Selecting a specific device from the droplist is the
              // "This device" intent: flip out of All-devices mode so the
              // list shows that device's chats instead of the merge.
              if (mode === 'all') setMode('this')
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Span wrapper so the Tooltip can wrap a disabled Button (radix
                  tooltip does not forward to disabled elements natively). The
                  single "All devices" toggle replaces the old two-button
                  This/All group: pressed = merge all devices, outline = show
                  only the device currently picked in the droplist. */}
              <span tabIndex={allDevicesDisabled ? 0 : -1} className="inline-flex">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === 'all' ? 'default' : 'outline'}
                  aria-pressed={mode === 'all'}
                  aria-label="Merge chats across all devices"
                  disabled={allDevicesDisabled}
                  onClick={() => setMode(mode === 'all' ? 'this' : 'all')}
                >
                  All devices
                </Button>
              </span>
            </TooltipTrigger>
            {allDevicesDisabled && (
              <TooltipContent side="bottom">Only one device connected</TooltipContent>
            )}
          </Tooltip>
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={hasMedia} onCheckedChange={setHasMedia} />
          With media only
        </label>
      </div>

      <div ref={scrollRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : visibleChats.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">No chats found</p>
        ) : (
          <>
            <ul className="divide-y">
              {isAllMode
                ? mergedRows.map((row) => (
                    <MergedRow
                      key={row.chat.jid}
                      row={row}
                      selected={selectedJid === row.chat.jid}
                      onSelect={onSelect}
                    />
                  ))
                : thisDeviceChats.map((chat) => (
                    <ThisDeviceRow
                      key={chat.jid}
                      chat={chat}
                      deviceId={deviceId}
                      selected={selectedJid === chat.jid}
                      onSelect={onSelect}
                    />
                  ))}
            </ul>
            {isFetchingNextPage && (
              <div className="flex justify-center py-3">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            )}
            {!hasNextPage && visibleChats.length > 0 && (
              <div className="text-muted-foreground py-3 text-center text-xs">No more chats</div>
            )}
            {errors.length > 0 && (
              <div className="text-muted-foreground py-2 text-center text-xs">
                {`${errors.length} device${errors.length === 1 ? '' : 's'} failed to load`}
              </div>
            )}
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
          </>
        )}
      </div>

      <div className="text-muted-foreground flex items-center justify-center border-t px-3 py-2 text-xs">
        {visibleChats.length}
        {isAllMode ? ' chats across devices' : ` of ${total} chats`}
      </div>
    </div>
  )
}

function ThisDeviceRow({
  chat,
  deviceId,
  selected,
  onSelect,
}: {
  chat: ChatInfo
  /**
   * Feature 3: the scoping device id for the unread badge. In This-device mode
   * this is the global `useDeviceStore.selectedDeviceId`. Threaded from the
   * parent so the badge's store key matches the bump's store key.
   */
  deviceId: string | null
  selected: boolean
  onSelect: (chat: ChatInfo, deviceId?: string) => void
}) {
  const unread = useEffectiveUnread(deviceId, chat)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(chat)}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
        )}
      >
        <ChatAvatar name={chat.name || chat.jid} size="md" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'truncate text-sm',
              selected ? 'text-accent-foreground font-semibold' : 'font-medium',
            )}
          >
            {chat.name || chat.jid}
          </span>
          <span className="text-muted-foreground truncate text-xs tabular-nums">
            {isZeroTime(chat.last_message_time) ? chat.jid : formatDate(chat.last_message_time)}
          </span>
        </span>
        <UnreadBadge count={unread} />
      </button>
    </li>
  )
}

function MergedRow({
  row,
  selected,
  onSelect,
}: {
  row: MergedChatRow
  selected: boolean
  onSelect: (chat: ChatInfo, deviceId?: string) => void
}) {
  const { chat, deviceId } = row
  // Feature 3: the unread badge is keyed on the merged row's owning device id
  // (NOT the global switcher), so an unread on a chat owned by device B shows
  // on device B's merged row and clears when that device-scoped conversation
  // is opened (F2.6).
  const unread = useEffectiveUnread(deviceId, chat)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(chat, deviceId)}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
        )}
      >
        <ChatAvatar name={chat.name || chat.jid} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'truncate text-sm',
                selected ? 'text-accent-foreground font-semibold' : 'font-medium',
              )}
            >
              {chat.name || chat.jid}
            </span>
            <DeviceTag row={row} />
          </span>
          <span className="text-muted-foreground truncate text-xs tabular-nums">
            {isZeroTime(chat.last_message_time) ? chat.jid : formatDate(chat.last_message_time)}
          </span>
        </span>
        <UnreadBadge count={unread} />
      </button>
    </li>
  )
}
