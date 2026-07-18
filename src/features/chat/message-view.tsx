import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Reply, Send, SmilePlus, X } from 'lucide-react'
import { getChatMessages, type ChatInfo, type MessageInfo } from '@/api/chat'
import { reactRequest } from '@/api/message'
import { exec } from '@/api/request'
import { sendText } from '@/api/send'
import { ChatAvatar } from '@/features/chat/chat-avatar'
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
import { useSelectedDevice } from '@/hooks/use-device-guard'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

// Fixed shortlist offered in the per-bubble react picker. The free-text Input
// in the dropdown covers anything outside this list, and "Remove" sends an
// empty emoji (the existing ReactForm placeholder documents that empty removes
// the reaction).
const REACTION_SHORTLIST = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function dayKey(timestamp: string): string {
  return new Date(timestamp).toDateString()
}

// Collapse repeated reactions into one pill per emoji with a count suffix.
// Insertion order is preserved (Map iterates in insertion order), so the first
// reaction wins display precedence for each emoji.
function groupReactions(reactions: { emoji: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1)
  }
  return counts
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
  const deviceId = useSelectedDevice()
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
        void queryClient.invalidateQueries({ queryKey: ['chat-messages', deviceId, chatJid] })
      },
    },
  )

  const sendReaction = (emoji: string) => {
    reactMutation.mutate({ messageId: message.id, emoji })
  }

  const reactionCounts = message.reactions ? groupReactions(message.reactions) : null

  return (
    <div
      className={cn(
        'group flex items-center gap-1',
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
        {reactionCounts && reactionCounts.size > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Array.from(reactionCounts, ([emoji, count]) => (
              <span
                key={emoji}
                className="bg-background/70 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs"
              >
                {emoji}
                {count > 1 ? ` ${count}` : ''}
              </span>
            ))}
          </div>
        )}
        <p className="text-muted-foreground mt-1 text-right text-xs">
          {formatDate(message.timestamp)}
        </p>
      </div>
      <div
        className={cn(
          'flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 motion-safe:transition-opacity',
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

export function MessageView({ chat, onBack }: { chat: ChatInfo; onBack?: () => void }) {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // Drives the stick-to-bottom jump. Set on chat switch, send-success, and (when
  // the user is near the bottom) after each poll refetch; cleared by the jump.
  const stickToBottomRef = useRef(true)
  // Tracks whether the viewport is within 80px of the bottom. Updated onScroll;
  // gates whether a poll-driven refetch gets to auto-scroll new messages in.
  const isNearBottomRef = useRef(true)
  // Anchors the viewport to a specific message id while an older-page fetch is
  // in flight. Replaces the previous height-delta approach (which drifted when
  // media loaded asynchronously and grew the page after the restore).
  const anchorIdRef = useRef<string | null>(null)
  // Gates the IntersectionObserver so a prepend cannot re-trigger it. Disarmed
  // the moment fetchNextPage fires; re-armed only when the user actively
  // scrolls down past the top zone (see handleScroll).
  const observerArmedRef = useRef(true)
  const deviceId = useSelectedDevice()
  const [search, setSearch] = useState('')
  const [mediaOnly, setMediaOnly] = useState(false)
  const [draft, setDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState<MessageInfo | null>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['chat-messages', deviceId, chat.jid, { search, mediaOnly }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getChatMessages(chat.jid, {
        search: search || undefined,
        media_only: mediaOnly || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.offset + lastPage.data.length < lastPage.pagination.total
        ? lastPage.pagination.offset + lastPage.data.length
        : undefined,
    // Upward-only pagination: there is no "newer than page 0" page to fetch via
    // getPreviousPageParam. Newer messages arrive through polling + invalidation.
    getPreviousPageParam: () => undefined,
    placeholderData: keepPreviousData,
    // Poll every 5s so incoming messages appear live without backend push.
    // refetchIntervalInBackground defaults to false in TanStack v5, so polling
    // pauses when the tab is hidden. MessageView only mounts when a chat is open,
    // so a constant interval is sufficient. New page-0 messages from a poll are
    // scrolled into view only when the user is already near the bottom (see
    // isNearBottomRef and the data-driven stick-to-bottom effect below).
    refetchInterval: 5_000,
  })

  // Flatten all pages newest-first, then reverse the WHOLE array to get
  // chronological (oldest at top, newest at bottom). NEVER mutate the cached
  // pages — spread/copy at every step. This preserves the documented ordering
  // invariant: render maps over `ordered`; day-separator reads `ordered[index-1]`.
  const messages = data?.pages.flatMap((p) => p.data) ?? []
  const ordered = [...messages].reverse()

  // New chat → arm stick-to-bottom so the first paint jumps to the newest, and
  // re-arm the load-older observer so the user CAN scroll up to fetch history
  // in the new chat (the flag must not stay disarmed from a prior chat).
  useEffect(() => {
    stickToBottomRef.current = true
    observerArmedRef.current = true
  }, [chat.jid])

  // Stick-to-bottom jump. useLayoutEffect (not useEffect) so it runs after DOM
  // mutations but BEFORE the browser paints — when TanStack hands back cached
  // data on a re-mount, the synchronous effect would read a partial scrollHeight
  // and undershoot the bottom; the layout-phase read sees the fully-laid-out
  // list. Deps include the `data` reference (not just ordered.length) because a
  // cached-page hydration can change `data` while ordered.length matches a stale
  // placeholderData value. Draft is deliberately absent so the scroll does not
  // fire on every keystroke. Older-message prepends do not arm stickToBottomRef
  // — the load-older anchor effect handles that viewport restoration.
  useLayoutEffect(() => {
    if (isLoading) return
    if (stickToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      stickToBottomRef.current = false
    }
  }, [chat.jid, data, isLoading])

  // After every successful fetch/refetch (including polls), if the user was
  // near the bottom, arm stick-to-bottom so newly arrived messages scroll in.
  // If the user was scrolled up reading history, leave them where they are.
  useEffect(() => {
    if (!isLoading && isNearBottomRef.current) {
      stickToBottomRef.current = true
    }
  }, [data, isLoading])

  // Load-older viewport anchor. When isFetchingNextPage goes true, capture the
  // id of the first message currently visible at the top of the list — that is
  // the message the user is reading, and it must remain in place after older
  // messages prepend above it. When the fetch settles (true→false), look the
  // anchor element up by data-msg-id and pin scrollTop so the anchor stays at
  // the same viewport offset. Anchoring on the DOM node (instead of a
  // scrollHeight delta) is robust to asynchronous media load that grows the
  // page after the restore: the node identity does not change when media loads,
  // only its measured height does, and we re-read offsetTop at restore time.
  useEffect(() => {
    if (isFetchingNextPage && anchorIdRef.current === null) {
      anchorIdRef.current = ordered[0]?.id ?? null
    }
    if (!isFetchingNextPage && anchorIdRef.current !== null && scrollRef.current) {
      const anchorEl = scrollRef.current.querySelector<HTMLElement>(
        `[data-msg-id="${CSS.escape(anchorIdRef.current)}"]`,
      )
      if (anchorEl) {
        scrollRef.current.scrollTop = anchorEl.offsetTop - scrollRef.current.clientTop
      }
      anchorIdRef.current = null
    }
  }, [isFetchingNextPage, ordered])

  // IntersectionObserver sentinel at the TOP of the scroll content. Upward
  // infinite scroll loads older messages ABOVE the current content, so the
  // sentinel sits before the message list. A 200px top rootMargin preloads
  // older messages before the user reaches the very top. The observerArmedRef
  // gate is what breaks the infinite-fetch loop: when older messages prepend,
  // the sentinel is pushed up into the viewport's top edge and would re-fire
  // intersection immediately. Disarming on fetch and re-arming only on a
  // deliberate downward scroll (see handleScroll) means a prepend cannot chain
  // into another fetch by itself.
  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          observerArmedRef.current &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          observerArmedRef.current = false
          void fetchNextPage({ cancelRefetch: false })
        }
      },
      { root, rootMargin: '200px 0px 0px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    // "Near bottom" = within 80px of the bottom. Used to decide whether a
    // poll-driven refetch should auto-scroll to show newly arrived messages.
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    // Re-arm the load-older observer only when the user scrolls DOWN past the
    // top zone. This is what breaks the infinite-fetch loop: a prepend pushes
    // the sentinel into the viewport's top edge, but until the user actively
    // scrolls down away from the top, observerArmedRef stays false and the
    // observer callback short-circuits.
    if (el.scrollTop > 100) {
      observerArmedRef.current = true
    }
  }

  const sendMutation = useActionMutation(
    (message: string) =>
      sendText({ phone: chat.jid, message, reply_message_id: replyTarget?.id || undefined }),
    {
      successMessage: 'Message sent',
      onSuccess: () => {
        // Arm stick-to-bottom so when the invalidation refetch grows
        // ordered.length, the stick-to-bottom effect scrolls to the new bottom.
        stickToBottomRef.current = true
        setDraft('')
        setReplyTarget(null)
        void queryClient.invalidateQueries({ queryKey: ['chat-messages', deviceId, chat.jid] })
      },
    },
  )

  const onSend = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) sendMutation.mutate(draft.trim())
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Back to chats"
            onClick={() => onBack?.()}
          >
            <ArrowLeft className="size-5" />
          </Button>
        )}
        <ChatAvatar name={chat.name || chat.jid} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-sm font-semibold">{chat.name || chat.jid}</h2>
          <p className="text-muted-foreground truncate font-mono text-xs">{chat.jid}</p>
        </div>
        <ChatControls chat={chat} />
      </div>

      <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          className="bg-muted/40 focus-visible:bg-background border-0 focus-visible:ring-1 sm:max-w-xs"
          placeholder="Search messages"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
          }}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch
            checked={mediaOnly}
            onCheckedChange={(value) => {
              setMediaOnly(value)
            }}
          />
          Media only
        </label>
      </div>

      <div
        ref={scrollRef}
        className="bg-muted/30 min-h-0 flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm">
            <p>No messages stored for this chat yet.</p>
            <p className="text-xs">
              Messages appear here as they are sent or received, and as WhatsApp history sync
              batches are processed after pairing. Contacts synced from your address book start
              without message history.
            </p>
          </div>
        ) : (
          <>
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
            {isFetchingNextPage && (
              <div className="flex justify-center py-3">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            )}
            {!hasNextPage && ordered.length > 0 && (
              <div className="text-muted-foreground py-2 text-center text-xs">
                Start of conversation
              </div>
            )}
            <div className="flex flex-col gap-2">
              {ordered.map((message, index) => {
                const showDateSeparator =
                  index === 0 || dayKey(message.timestamp) !== dayKey(ordered[index - 1].timestamp)
                return (
                  <div key={message.id} data-msg-id={message.id}>
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
                    <MessageBubble message={message} chatJid={chat.jid} onReply={setReplyTarget} />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {replyTarget && (
        <div className="bg-muted/40 border-primary flex items-center gap-2 border-l-2 px-3 py-2 text-sm">
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

      <form className="flex items-center gap-2 border-t px-3 py-2.5" onSubmit={onSend}>
        <Input
          className="flex-1"
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
