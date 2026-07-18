import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { listChats, type ChatInfo } from '@/api/chat'
import { ChatAvatar } from '@/features/chat/chat-avatar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useSelectedDevice } from '@/hooks/use-device-guard'
import { formatDate, isZeroTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export function ChatList({
  selectedJid,
  onSelect,
}: {
  selectedJid: string | null
  onSelect: (chat: ChatInfo) => void
}) {
  const [search, setSearch] = useState('')
  const [hasMedia, setHasMedia] = useState(false)
  const deviceId = useSelectedDevice()

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const query = useInfiniteQuery({
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
    // Poll every 5s so newly received chats appear live without backend push.
    // refetchIntervalInBackground defaults to false in TanStack v5, so polling
    // already pauses when the tab is hidden. When no device is selected there
    // is nothing to poll.
    refetchInterval: deviceId ? 5_000 : false,
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = query

  // Flatten pages + dedupe by jid. Polling (refetchInterval) refetches every
  // page periodically, and if a chat shifts between pages during a refetch it
  // can appear briefly in two pages. Dedupe by jid keeps the rendered list
  // clean and stable.
  const seen = new Set<string>()
  const chats = (data?.pages.flatMap((p) => p.data) ?? []).filter((c) => {
    if (seen.has(c.jid)) return false
    seen.add(c.jid)
    return true
  })
  // Every page carries the same total; read it from the first page.
  const total = data?.pages[0]?.pagination.total ?? 0

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      // 200px bottom rootMargin preloads the next page before the user hits
      // the very bottom of the list, giving the "load more at ~80%" feel.
      { root, rootMargin: '0px 0px 200px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-col gap-2 border-b px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2 size-4" />
          <Input
            className="bg-muted/40 focus-visible:bg-background border-0 pl-8 focus-visible:ring-1"
            placeholder="Search chats"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={hasMedia} onCheckedChange={setHasMedia} />
          With media only
        </label>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {query.isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">No chats found</p>
        ) : (
          <>
            <ul className="divide-y">
              {chats.map((chat) => (
                <li key={chat.jid}>
                  <button
                    type="button"
                    onClick={() => onSelect(chat)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      'hover:bg-muted/50',
                      selectedJid === chat.jid && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <ChatAvatar name={chat.name || chat.jid} size="md" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{chat.name || chat.jid}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {isZeroTime(chat.last_message_time)
                          ? chat.jid
                          : formatDate(chat.last_message_time)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {isFetchingNextPage && (
              <div className="flex justify-center py-3">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            )}
            {!hasNextPage && chats.length > 0 && (
              <div className="text-muted-foreground py-3 text-center text-xs">No more chats</div>
            )}
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
          </>
        )}
      </div>

      <div className="text-muted-foreground flex items-center justify-center border-t px-3 py-2 text-xs">
        {chats.length} of {total} chats
      </div>
    </div>
  )
}
