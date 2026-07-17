import { useEffect, useRef, useState, type FormEvent } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Reply, Send, SmilePlus, X } from 'lucide-react'
import { getChatMessages, type ChatInfo, type MessageInfo } from '@/api/chat'
import { reactRequest } from '@/api/message'
import { exec } from '@/api/request'
import { sendText } from '@/api/send'
import { MessageMedia } from '@/features/chat/message-media'
import { ChatControls } from '@/features/chat/chat-controls'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 30

// Fixed shortlist offered in the per-bubble react picker. The free-text Input
// in the dropdown covers anything outside this list, and "Remove" sends an
// empty emoji (the existing ReactForm placeholder documents that empty removes
// the reaction).
const REACTION_SHORTLIST = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function dayKey(timestamp: string): string {
  return new Date(timestamp).toDateString()
}

function MessageBubble({
  message,
  chatJid,
  onReply,
}: {
  message: MessageInfo
  chatJid: string
  onReply: (message: MessageInfo) => void
}) {
  const queryClient = useQueryClient()
  const hasMedia = message.media_type && message.media_type !== ''
  const [customEmoji, setCustomEmoji] = useState('')

  // Reuse the proven reactRequest + exec + useActionMutation trio (the same
  // pattern MessageActionForm uses in message-forms.tsx). `phone` stays
  // chat.jid for the chat viewer (NOT the global recipient store), and an
  // empty emoji is a remove per the existing ReactForm contract.
  const reactMutation = useActionMutation(
    (vars: { messageId: string; emoji: string }) =>
      exec(reactRequest(vars.messageId, { phone: chatJid, emoji: vars.emoji })),
    {
      successMessage: 'Reaction sent',
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['chat-messages', chatJid] })
      },
    },
  )

  const sendReaction = (emoji: string) => {
    reactMutation.mutate({ messageId: message.id, emoji })
  }

  return (
    <div
      className={cn(
        'group flex items-end gap-1',
        message.is_from_me ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-xs',
          message.is_from_me ? 'bg-bubble-out rounded-br-sm' : 'bg-bubble-in rounded-bl-sm border',
        )}
      >
        {!message.is_from_me && (
          <p className="text-muted-foreground mb-0.5 font-mono text-xs">{message.sender_jid}</p>
        )}
        {message.content && <p className="break-words whitespace-pre-wrap">{message.content}</p>}
        {hasMedia && <MessageMedia message={message} />}
        {message.reactions && message.reactions.length > 0 && (
          <p className="mt-1 text-xs">{message.reactions.map((r) => r.emoji).join(' ')}</p>
        )}
        <p className="text-muted-foreground mt-1 text-right text-xs">
          {formatDate(message.timestamp)}
        </p>
      </div>
      <div
        className={cn(
          'flex items-end gap-0.5 opacity-0 motion-safe:transition-opacity group-hover:opacity-100 focus-within:opacity-100',
          message.is_from_me ? 'order-first' : 'order-last',
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-6 focus-visible:opacity-100"
              aria-label="React to message"
              disabled={reactMutation.isPending}
            >
              <SmilePlus className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={message.is_from_me ? 'end' : 'start'}>
            <div className="flex flex-wrap gap-1 p-1">
              {REACTION_SHORTLIST.map((emoji) => (
                <DropdownMenuItem
                  key={emoji}
                  className="justify-center text-base"
                  onSelect={() => sendReaction(emoji)}
                >
                  {emoji}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <form
              className="flex items-center gap-1 p-1"
              onSubmit={(event) => {
                event.preventDefault()
                const trimmed = customEmoji.trim()
                if (trimmed) {
                  sendReaction(trimmed)
                  setCustomEmoji('')
                }
              }}
            >
              <Input
                value={customEmoji}
                className="h-8 text-sm"
                placeholder="Emoji"
                onChange={(event) => setCustomEmoji(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={!customEmoji.trim()}>
                Send
              </Button>
            </form>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => sendReaction('')}>
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-6 focus-visible:opacity-100"
          aria-label="Reply to message"
          onClick={() => onReply(message)}
        >
          <Reply className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function MessageView({ chat }: { chat: ChatInfo }) {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [search, setSearch] = useState('')
  const [mediaOnly, setMediaOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const [draft, setDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState<MessageInfo | null>(null)

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
  // Reverse a COPY: `messages` is a reference into the TanStack Query cache,
  // so we never mutate it. The API returns newest-first within each page;
  // reversing gives the chronological top-to-bottom order every chat client uses.
  const ordered = [...messages].reverse()
  const total = query.data?.pagination.total ?? 0

  // Auto-scroll the pane to the newest message on chat switch, initial load,
  // and list growth (e.g. after a send invalidates and refetches). Instant jump
  // (no smooth behaviour); `draft` is intentionally absent from the deps so the
  // scroll does not fire on every keystroke.
  useEffect(() => {
    if (query.isLoading) return
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chat.jid, messages.length, query.isLoading])

  const sendMutation = useActionMutation(
    (message: string) =>
      sendText({ phone: chat.jid, message, reply_message_id: replyTarget?.id || undefined }),
    {
      successMessage: 'Message sent',
      onSuccess: () => {
        setDraft('')
        setReplyTarget(null)
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
          <p className="text-muted-foreground truncate font-mono text-xs">{chat.jid}</p>
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
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
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

      <div
        ref={scrollRef}
        className="bg-muted/40 min-h-0 flex-1 overflow-y-auto rounded-lg border p-3"
      >
        {query.isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-muted-foreground flex flex-col gap-1 p-6 text-center text-sm">
            <p>No messages stored for this chat yet.</p>
            <p className="text-xs">
              Messages appear here as they are sent or received, and as WhatsApp history sync
              batches are processed after pairing. Contacts synced from your address book start
              without message history.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ordered.map((message, index) => {
              const showDateSeparator =
                index === 0 || dayKey(message.timestamp) !== dayKey(ordered[index - 1].timestamp)
              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center py-1">
                      <span className="bg-card text-muted-foreground rounded-full border px-3 py-0.5 text-xs shadow-xs">
                        {new Date(message.timestamp).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    chatJid={chat.jid}
                    onReply={setReplyTarget}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-xs">
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

      {replyTarget && (
        <div className="bg-muted/40 flex items-center gap-2 rounded-lg border p-2 text-sm">
          <Reply className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground truncate font-mono text-xs">
              {replyTarget.sender_jid}
            </p>
            <p className="truncate">
              {replyTarget.content || (replyTarget.media_type ? '[media]' : '')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-6 shrink-0"
            aria-label="Cancel reply"
            onClick={() => setReplyTarget(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

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
