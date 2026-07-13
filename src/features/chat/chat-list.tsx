import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { listChats, type ChatInfo } from '@/api/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { formatDate, isZeroTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

export function ChatList({
  selectedJid,
  onSelect,
}: {
  selectedJid: string | null
  onSelect: (chat: ChatInfo) => void
}) {
  const [search, setSearch] = useState('')
  const [hasMedia, setHasMedia] = useState(false)
  const [offset, setOffset] = useState(0)

  const query = useQuery({
    queryKey: ['chats', { search, hasMedia, offset }],
    queryFn: () =>
      listChats({ search: search || undefined, has_media: hasMedia || undefined, limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  })

  const chats = query.data?.data ?? []
  const total = query.data?.pagination.total ?? 0

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search chats"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={hasMedia}
            onCheckedChange={(value) => {
              setHasMedia(value)
              setOffset(0)
            }}
          />
          With media only
        </label>
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-md border">
        {query.isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : chats.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No chats found</p>
        ) : (
          <ul className="divide-y">
            {chats.map((chat) => (
              <li key={chat.jid}>
                <button
                  type="button"
                  onClick={() => onSelect(chat)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted/50',
                    selectedJid === chat.jid && 'bg-muted',
                  )}
                >
                  <span className="w-full truncate text-sm font-medium">
                    {chat.name || chat.jid}
                  </span>
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {isZeroTime(chat.last_message_time) ? chat.jid : formatDate(chat.last_message_time)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} chats</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
