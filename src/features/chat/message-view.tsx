import { useState, type FormEvent } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { getChatMessages, type ChatInfo, type MessageInfo } from '@/api/chat'
import { sendText } from '@/api/send'
import { MessageMedia } from '@/features/chat/message-media'
import { ChatControls } from '@/features/chat/chat-controls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 30

function MessageBubble({ message }: { message: MessageInfo }) {
  const hasMedia = message.media_type && message.media_type !== ''
  return (
    <div className={cn('flex', message.is_from_me ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-3 py-2 text-sm',
          message.is_from_me ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {!message.is_from_me && (
          <p className="mb-0.5 text-xs opacity-70">{message.sender_jid}</p>
        )}
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
        {hasMedia && <MessageMedia message={message} />}
        {message.reactions && message.reactions.length > 0 && (
          <p className="mt-1 text-xs">{message.reactions.map((r) => r.emoji).join(' ')}</p>
        )}
        <p className="mt-1 text-[10px] opacity-60">{formatDate(message.timestamp)}</p>
      </div>
    </div>
  )
}

export function MessageView({ chat }: { chat: ChatInfo }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [mediaOnly, setMediaOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const [draft, setDraft] = useState('')

  const query = useQuery({
    queryKey: ['chat-messages', chat.jid, { search, mediaOnly, offset }],
    queryFn: () =>
      getChatMessages(chat.jid, {
        search: search || undefined,
        media_only: mediaOnly || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  const messages = query.data?.data ?? []
  const total = query.data?.pagination.total ?? 0

  const sendMutation = useActionMutation(
    (message: string) => sendText({ phone: chat.jid, message }),
    {
      successMessage: 'Message sent',
      onSuccess: () => {
        setDraft('')
        void queryClient.invalidateQueries({ queryKey: ['chat-messages', chat.jid] })
      },
    },
  )

  const onSend = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) sendMutation.mutate(draft.trim())
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2 border-b pb-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{chat.name || chat.jid}</h2>
          <p className="truncate font-mono text-xs text-muted-foreground">{chat.jid}</p>
        </div>
        <ChatControls chat={chat} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          className="sm:max-w-xs"
          placeholder="Search messages"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setOffset(0)
          }}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={mediaOnly}
            onCheckedChange={(value) => {
              setMediaOnly(value)
              setOffset(0)
            }}
          />
          Media only
        </label>
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-md border p-3">
        {query.isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col gap-1 p-6 text-center text-sm text-muted-foreground">
            <p>No messages stored for this chat yet.</p>
            <p className="text-xs">
              Messages appear here as they are sent or received, and as WhatsApp history sync
              batches are processed after pairing. Contacts synced from your address book start
              without message history.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} messages</span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Older
          </Button>
        </div>
      </div>

      <form className="flex gap-2" onSubmit={onSend}>
        <Input
          placeholder="Type a message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" disabled={sendMutation.isPending || !draft.trim()}>
          {sendMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Send
        </Button>
      </form>
    </div>
  )
}
