import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type FormEvent,
} from 'react'
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  FolderDown,
  Loader2,
  Paperclip,
  Reply,
  Send,
  SmilePlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { getChatMessages, type ChatInfo, type MessageInfo, type ReactionInfo } from '@/api/chat'
import { reactRequest } from '@/api/message'
import { exec } from '@/api/request'
import { sendText } from '@/api/send'
import { ChatAvatar } from '@/features/chat/chat-avatar'
import { MediaBurstDialog } from '@/features/chat/media-burst-dialog'
import { MessageMedia } from '@/features/chat/message-media'
import { ChatControls } from '@/features/chat/chat-controls'
import { MediaPreviewDialog } from '@/features/chat/media-preview-dialog'
import { useMediaBurst } from '@/hooks/use-media-burst'
import { useAppInfo } from '@/hooks/use-app-info'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import { useSettingsStore } from '@/stores/settings'
import { useUnreadStore } from '@/stores/unread'
import { useDevices } from '@/hooks/use-devices'
import type { RegistryDevice } from '@/api/types'
import { computeUnreadDelta } from '@/lib/unread-diff'
import { classifyMedia } from '@/lib/media-classify'
import { MAX_MEDIA_BYTES, validateMediaFile } from '@/lib/media-validate'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useTranslation } from '@/stores/i18n'
import { formatDate, formatFileTimestamp } from '@/lib/format'
import { jidToPhone } from '@/lib/jid'
import { tokenizeMessageText } from '@/lib/linkify'
import { cn } from '@/lib/utils'
import { buildChatZipName } from '@/lib/zip'

const PAGE_SIZE = 50

// Fixed shortlist offered in the per-bubble react picker. The free-text Input
// in the dropdown covers anything outside this list, and "Remove" sends an
// empty emoji (the existing ReactForm placeholder documents that empty removes
// the reaction).
const REACTION_SHORTLIST = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function dayKey(timestamp: string): string {
  return new Date(timestamp).toDateString()
}

/**
 * The id of the most recent incoming (`!is_from_me`) message in `ordered` for
 * the given chat, or null when there are none. Used by the unread-divider
 * effect to seed and advance its "previously seen" cursor. `ordered` is
 * chronological (oldest first, newest last), so the last incoming match wins.
 */
function topIncomingId(ordered: readonly MessageInfo[], chatJid: string): string | null {
  for (let i = ordered.length - 1; i >= 0; i--) {
    const message = ordered[i]
    if (message.chat_jid !== chatJid) continue
    if (message.is_from_me) continue
    return message.id
  }
  return null
}


function MessageBubble({
  message,
  chatJid,
  deviceId,
  onReply,
}: {
  message: MessageInfo
  chatJid: string
  // Feature 2: the conversation's scoping device id, threaded from
  // MessageView's prop. Reaction invalidation keys on it so a reaction sent
  // from an All-devices-scoped conversation refreshes that device's messages,
  // not the global one.
  deviceId: string
  onReply: (message: MessageInfo) => void
}) {
  const queryClient = useQueryClient()
  const hasMedia = message.media_type && message.media_type !== ''
  const [customEmoji, setCustomEmoji] = useState('')
  const { language } = useTranslation()

  // Reuse the proven reactRequest + exec + useActionMutation trio (the same
  // pattern MessageActionForm uses in message-forms.tsx). `phone` stays
  // chat.jid for the chat viewer (NOT the global recipient store), and an
  // empty emoji is a remove per the existing ReactForm contract.
  const reactMutation = useActionMutation(
    (vars: { messageId: string; emoji: string }) =>
      exec(reactRequest(vars.messageId, { phone: chatJid, emoji: vars.emoji }), {
        headers: deviceId ? { 'X-Device-Id': encodeURIComponent(deviceId) } : undefined,
      }),
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

  const reactionsByEmoji = useMemo(() => {
    if (!message.reactions) return new Map<string, ReactionInfo[]>()
    const groups = new Map<string, ReactionInfo[]>()
    for (const r of message.reactions) {
      const list = groups.get(r.emoji) ?? []
      list.push(r)
      groups.set(r.emoji, list)
    }
    return groups
  }, [message.reactions])

  const isRtl = language === 'ar' || language === 'ur'
  const alignmentClass = isRtl
    ? (message.is_from_me ? 'justify-start' : 'justify-end')
    : (message.is_from_me ? 'justify-end' : 'justify-start')

  return (
    <div
      className={cn(
        'group flex items-start gap-1',
        alignmentClass,
      )}
    >
      <div
        className={cn(
          'w-[350px] max-w-[85%] rounded-[1.25rem] px-3.5 py-2 text-sm ring-1 transition-colors',
          message.is_from_me
            ? 'bg-bubble-out text-primary-foreground ring-bubble-out/40 rounded-br-md'
            : 'bg-bubble-in text-foreground ring-border rounded-bl-md',
        )}
      >
        {!message.is_from_me && (
          <p className="text-muted-foreground mb-1 font-mono text-xs">{jidToPhone(message.sender_jid)}</p>
        )}
        {message.content && (
          <p className="leading-relaxed break-words whitespace-pre-wrap">
            {tokenizeMessageText(message.content).map((token, index) =>
              token.kind === 'link' ? (
                <a
                  key={index}
                  href={token.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'underline underline-offset-2 transition-colors font-medium',
                    message.is_from_me
                      ? 'text-primary-foreground hover:text-primary-foreground/80'
                      : 'text-primary hover:text-primary/80',
                  )}
                >
                  {token.value}
                </a>
              ) : (
                token.value || null
              ),
            )}
          </p>
        )}
        {hasMedia && <MessageMedia message={message} deviceId={deviceId} />}
        {reactionsByEmoji && reactionsByEmoji.size > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Array.from(reactionsByEmoji, ([emoji, list]) => (
              <Tooltip key={emoji}>
                <TooltipTrigger asChild>
                  <span
                    className="bg-background border-border inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow-xs transition-transform hover:scale-110 cursor-help"
                  >
                    {emoji}
                    {list.length > 1 ? (
                      <span className="text-muted-foreground tabular-nums">{list.length}</span>
                    ) : null}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="flex flex-col gap-1 p-2 max-w-[200px] text-start bg-popover text-popover-foreground border border-border shadow-md">
                  <p className="font-semibold text-xs border-b pb-1 mb-1">{emoji} Reactions</p>
                  <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                    {list.map((r, i) => (
                      <span key={i} className="text-xs font-mono">
                        {r.is_from_me ? 'Me' : jidToPhone(r.sender_jid)}
                      </span>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
        <p
          className={cn(
            'mt-1 text-right text-[0.6875rem] tabular-nums',
            message.is_from_me ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
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
          <DropdownMenuContent
            align={message.is_from_me ? 'end' : 'start'}
            className="min-w-[15rem] gap-1 p-1.5"
          >
            <div className="grid grid-cols-6 gap-0.5">
              {REACTION_SHORTLIST.map((emoji) => (
                <DropdownMenuItem
                  key={emoji}
                  className="data-[highlighted]:bg-accent justify-center rounded-md text-xl"
                  onSelect={() => sendReaction(emoji)}
                >
                  {emoji}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator className="my-1" />
            <form
              className="flex items-center gap-1.5 px-1 py-0.5"
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
                className="bg-muted/40 focus-visible:bg-background h-8 border-0 text-sm focus-visible:ring-1"
                placeholder="Custom emoji"
                onChange={(event) => setCustomEmoji(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={!customEmoji.trim()}>
                Send
              </Button>
            </form>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem variant="destructive" onSelect={() => sendReaction('')}>
              Remove reaction
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

function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function MessageView({
  chat,
  deviceId,
  owningDeviceIds,
  onDeviceIdChange,
  onBack,
}: {
  chat: ChatInfo
  /**
   * Feature 2: the device this conversation is scoped to. In This-device mode
   * this is `useDeviceStore.selectedDeviceId`; in All-devices mode it is the
   * merged row's owning device id, captured in `conversationDeviceId` state in
   * `pages/chats.tsx`. The chat viewer owns its scoping now — the global
   * device switcher in the top bar is untouched when an All-devices row is
   * opened. Threads into `getChatMessages` (per-request X-Device-Id header
   * override), `sendText` (same header), and the react invalidation key so a
   * cross-device conversation reads from, writes to, and invalidates only its
   * own device's query cache.
   */
  deviceId: string
  owningDeviceIds?: string[]
  onDeviceIdChange?: (id: string) => void
  onBack?: () => void
}) {
  const { t } = useTranslation()
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
  // Feature 3 — in-conversation unread divider. These refs and state are
  // DELIBERATELY separate from the four auto-scroll concerns above
  // (stickToBottomRef / isNearBottomRef / observerArmedRef / anchorIdRef).
  // The divider reads the same `data` but never touches the scroll-restore
  // refs, so adding it cannot disturb the load-older anchor or the
  // stick-to-bottom jump.
  // `prevTopIncomingIdRef` is the cursor the divider effect diffs against; it
  // does not need to trigger renders, so a ref is correct.
  const prevTopIncomingIdRef = useRef<string | null>(null)
  // `unreadDivider` is the {anchor id, count} the render loop reads, or null
  // when no divider is showing. State (not a ref) so updating it re-renders.
  const [unreadDivider, setUnreadDivider] = useState<{
    anchorId: string
    count: number
  } | null>(null)
  const [search, setSearch] = useState('')
  const [mediaOnly, setMediaOnly] = useState(false)
  const debouncedSearch = useDebounce(search, 300)
  const [draft, setDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState<MessageInfo | null>(null)
  // Burst gap (the configurable "files arriving close together" window) lives
  // in the persisted settings store so the operator can tune it from Settings
  // and have it survive a reload. The chip + dialog + burst all derive from
  // this single value, and the burst recomputes on every poll-driven `ordered`
  // change via the memo inside useMediaBurst.
  const mediaBurstGapMin = useSettingsStore((s) => s.mediaBurstGapMin)
  const setMediaBurstGapMin = useSettingsStore((s) => s.setMediaBurstGapMin)
  const maxGapMs = mediaBurstGapMin * 60 * 1000
  const [burstOpen, setBurstOpen] = useState(false)
  // Feature 4 — compose-bar file attachment. `pendingFile` + `previewOpen`
  // drive the MediaPreviewDialog; `fileInputRef` points at the hidden
  // <input type="file"> the paperclip button click()es open; `dragActive`
  // toggles the state-encoding ring on the compose form during a drag. These
  // are deliberately separate from the four auto-scroll refs above and the F3
  // divider refs — the attachment flow never touches scroll-restore or
  // unread-divider state.
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  // Per-type size ceilings from the backend (AppInfo), used by the validator
  // before the preview opens. Falls back to MAX_MEDIA_BYTES (16 MiB) when
  // AppInfo has not loaded yet or reports zero — the validator's contract is
  // "pure function of (file, limits)" so the hook just feeds it the right
  // ceiling per kind.
  const { data: appInfo } = useAppInfo()
  const { data: devices } = useDevices()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['chat-messages', deviceId, chat.jid, { search: debouncedSearch, mediaOnly }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getChatMessages(
        chat.jid,
        {
          search: debouncedSearch || undefined,
          media_only: mediaOnly || undefined,
          limit: PAGE_SIZE,
          offset: pageParam,
        },
        deviceId,
      ),
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

  // Immediate/realtime client-side filter to ensure responsive and 100% correct matching
  const filteredOrdered = (() => {
    let list = ordered
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((m) => {
        return (
          m.content?.toLowerCase().includes(q) ||
          m.filename?.toLowerCase().includes(q) ||
          m.sender_jid.toLowerCase().includes(q)
        )
      })
    }
    if (mediaOnly) {
      list = list.filter((m) => !!m.media_type)
    }
    return list
  })()

  // Burst is computed from `ordered` (not the un-reversed `messages`) so the
  // clustered list in the dialog reads top-to-bottom in chronological order.
  const burst = useMediaBurst(ordered, maxGapMs)

  // New chat → arm stick-to-bottom so the first paint jumps to the newest, and
  // re-arm the load-older observer so the user CAN scroll up to fetch history
  // in the new chat (the flag must not stay disarmed from a prior chat). Also
  // clears this chat's unread badge in the store (Feature 3): opening a
  // conversation is the read event, and resets the divider cursor so a stale
  // anchor from the previously-open chat does not leak in.
  // We also clear chat-specific state (replyTarget, draft, search, mediaOnly)
  // so switching conversations does not carry over stale state.
  useEffect(() => {
    stickToBottomRef.current = true
    observerArmedRef.current = true
    prevTopIncomingIdRef.current = null
    setUnreadDivider(null)
    setReplyTarget(null)
    setDraft('')
    setSearch('')
    setMediaOnly(false)
    useUnreadStore.getState().clear(deviceId, chat.jid)
  }, [chat.jid, deviceId])

  // Reveal the polished scrollbar thumb only while scrolling the conversation.
  // Re-binds on chat switch so the listener attaches to the fresh container.
  useChatScroll(scrollRef, [chat.jid])

  // Feature 3 — feed the in-conversation unread divider. On each poll-driven
  // `data` change, when the tab is hidden OR the window lacks focus, diff the
  // incoming messages against the previously-seen top incoming id and grow the
  // divider count by the delta. The anchor is set once on the 0 → non-zero
  // transition so it marks the FIRST message that arrived while away (the
  // divider sits above that bubble in the render loop). This effect reads the
  // same `data` as the auto-scroll effects but touches NONE of their refs —
  // the two concerns are fully independent.
  //
  // `refetchIntervalInBackground` defaults to false in TanStack v5, so the
  // query pauses when the tab is hidden; the real driver is the window-blur
  // case (polling continues while the tab is visible but unfocused). When the
  // user returns, the visibility/focus listener below clears the divider and
  // scrolls the anchor into view.
  useEffect(() => {
    if (isLoading) return
    const away = document.visibilityState !== 'visible' || !document.hasFocus()
    if (!away) {
      // Refresh the cursor while present so the next away-window diff starts
      // from the most recent incoming id we have actually shown the user.
      prevTopIncomingIdRef.current = topIncomingId(ordered, chat.jid)
      return
    }
    const result = computeUnreadDelta(
      prevTopIncomingIdRef.current,
      ordered,
      chat.jid,
      // isSelected is always true here — this conversation IS open — but the
      // divider's away-window logic is independent of the badge suppression,
      // so we pass false to let the delta through and gate it on `away` above.
      false,
    )
    if (result.delta > 0) {
      setUnreadDivider((prev) => {
        const nextCount = (prev?.count ?? 0) + result.delta
        const anchorId = prev?.anchorId ?? result.firstNewIncomingId ?? ''
        return anchorId === '' ? null : { anchorId, count: nextCount }
      })
    }
    // Advance the cursor so the next poll only counts messages newer than this
    // one (the anchor is stable; the count grows).
    prevTopIncomingIdRef.current = topIncomingId(ordered, chat.jid) ?? prevTopIncomingIdRef.current
  }, [data, ordered, chat.jid, isLoading])

  // Feature 3 — clear the divider and scroll the anchor into view when the
  // user returns. Registered once on mount (no deps) so the listeners are
  // stable; it reads `unreadDivider` through a ref mirror so the handler
  // always sees the latest value without re-registering on every count change.
  const unreadDividerRef = useRef(unreadDivider)
  unreadDividerRef.current = unreadDivider
  useEffect(() => {
    const onReturn = () => {
      const current = unreadDividerRef.current
      // Only act when the tab is visible AND focused — intermediate
      // visibilitychange fires (e.g. screen lock) without a real return.
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return
      if (!current) return
      const anchorEl = scrollRef.current?.querySelector<HTMLElement>(
        `[data-msg-id="${CSS.escape(current.anchorId)}"]`,
      )
      setUnreadDivider(null)
      if (anchorEl && scrollRef.current) {
        scrollRef.current.scrollTop = anchorEl.offsetTop - scrollRef.current.clientTop
      }
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [])

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
      sendText({
        phone: chat.jid,
        message,
        reply_message_id: replyTarget?.id || undefined,
        // Scope the send to this conversation's device — an All-devices-scoped
        // conversation must reply on its row's device, not the global one.
        deviceId,
      }),
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

  // Feature 4 — pick a file (from the paperclip button or a drag-and-drop),
  // validate it, and open the preview. Validation failures fire `toast.error`
  // directly (verb+object copy from the validator's `reason`) and never open
  // the dialog — they are not mutation results, so they bypass
  // useActionMutation. On success, the file lands in `pendingFile` and the
  // preview opens; the dialog's own onSent arms the auto-scroll + clears the
  // reply target + invalidates (see onFileSent below). The per-kind size
  // ceiling is picked from AppInfo when available, falling back to the
  // 16 MiB constant; a zero AppInfo value is treated as "unset" and also
  // falls back, because gowa reports 0 on misconfiguration.
  const maxBytesFor = (file: File): number => {
    const kind = classifyMedia(file)
    if (appInfo) {
      if (kind === 'image' && appInfo.max_image_size > 0) return appInfo.max_image_size
      if (kind === 'video' && appInfo.max_video_size > 0) return appInfo.max_video_size
      if (appInfo.max_file_size > 0) return appInfo.max_file_size
    }
    return MAX_MEDIA_BYTES
  }

  const handlePicked = (file?: File | null) => {
    if (!file) return
    const result = validateMediaFile(file, { maxBytes: maxBytesFor(file) })
    if (!result.ok) {
      toast.error(result.reason)
      return
    }
    setPendingFile(file)
    setPreviewOpen(true)
  }

  // After the preview's send succeeds, mirror the text sendMutation's
  // onSuccess: arm stick-to-bottom so the just-sent bubble scrolls into
  // view on the invalidation refetch, clear the reply target, and invalidate
  // the device-scoped message query. Closing the preview here is intentional
  // — the operator has committed the send, the dialog has done its job.
  const onFileSent = () => {
    stickToBottomRef.current = true
    setReplyTarget(null)
    setPreviewOpen(false)
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    void queryClient.invalidateQueries({ queryKey: ['chat-messages', deviceId, chat.jid] })
  }

  // Drag-and-drop onto the compose form. preventDefault on dragover is what
  // allows the subsequent drop event to fire (browsers otherwise swallow it);
  // the dragActive ring is the single visual change, applied via a state ring
  // per the impeccable product-register (no overlay card, no glassmorphism).
  const onDragOver = (event: ReactDragEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dragActive) setDragActive(true)
  }
  const onDragLeave = (event: ReactDragEvent<HTMLFormElement>) => {
    // Only clear when leaving the form itself, not when crossing into a child
    // (the input, the paperclip). The relatedTarget check avoids flicker.
    if (event.currentTarget === event.target) setDragActive(false)
  }
  const onDrop = (event: ReactDragEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDragActive(false)
    handlePicked(event.dataTransfer.files[0])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
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
        <ChatAvatar name={chat.name || chat.jid} jid={chat.jid} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-sm leading-tight font-semibold">{chat.name || jidToPhone(chat.jid)}</h2>
          <p className="text-muted-foreground truncate font-mono text-xs leading-tight">
            {jidToPhone(chat.jid)}
          </p>
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Label htmlFor="media-burst-gap" className="sr-only">
            Media burst gap (minutes)
          </Label>
          <Input
            id="media-burst-gap"
            type="number"
            min={1}
            max={60}
            step={1}
            aria-label="Media burst gap (minutes)"
            className="h-8 w-16 tabular-nums"
            value={mediaBurstGapMin}
            onChange={(e) => setMediaBurstGapMin(e.target.valueAsNumber)}
          />
          <span aria-hidden="true">{t('min gap')}</span>
        </div>
        <Button
          variant="ghost"
          aria-label="Download recent media"
          disabled={burst.files.length === 0}
          onClick={() => setBurstOpen(true)}
          className="text-muted-foreground hover:bg-muted h-8 gap-1.5 px-2"
        >
          <Download className="size-4" />
          {burst.files.length > 0 && (
            <span className="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums">
              {burst.files.length}
            </span>
          )}
        </Button>
        <ChatControls chat={chat} />
      </div>

      {owningDeviceIds && owningDeviceIds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2 text-xs">
          <span className="text-muted-foreground font-medium shrink-0">{t('Viewing Account:')}</span>
          <div className="flex flex-wrap gap-1.5">
            {owningDeviceIds.map((id) => (
              <DeviceTabButton
                key={id}
                id={id}
                active={deviceId === id}
                onClick={() => onDeviceIdChange?.(id)}
                devices={devices}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-b px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Input
            className="bg-muted/40 focus-visible:bg-background border-0 focus-visible:ring-1 pe-9 w-full"
            placeholder={t('Search messages')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 end-3 -translate-y-1/2 rounded-sm p-0.5"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          <Switch
            checked={mediaOnly}
            onCheckedChange={(value: boolean) => {
              setMediaOnly(value)
            }}
          />
          {t('Media only')}
        </label>
      </div>

      <div
        ref={scrollRef}
        className="chat-scroll bg-muted/30 relative min-h-0 flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {burst.files.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            aria-label="Download recent media"
            className={cn(
              'absolute top-2 left-1/2 z-10 -translate-x-1/2 shadow-xs',
              burst.isCollectible && 'ring-primary/30 ring-1 motion-safe:animate-pulse',
            )}
            onClick={() => setBurstOpen(true)}
          >
            <FolderDown className="size-3.5" />
            {`${burst.files.length} file${burst.files.length === 1 ? '' : 's'} ${t('just in')}`}
          </Button>
        )}
        {isLoading && filteredOrdered.length === 0 ? (
          <div className="flex justify-center p-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm">
            <p>{t('No messages stored for this chat yet.')}</p>
            <p className="text-xs">
              {t('Messages appear here as they are sent or received, and as WhatsApp history sync batches are processed after pairing. Contacts synced from your address book start without message history.')}
            </p>
          </div>
        ) : filteredOrdered.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm">
            <p>{t('No messages found')}</p>
          </div>
        ) : (
          <>
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
            {isFetchingNextPage && (
              <div className="flex justify-center py-3">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            )}
            {!hasNextPage && filteredOrdered.length > 0 && (
              <div className="text-muted-foreground py-2 text-center text-xs">
                {t('Start of conversation')}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {filteredOrdered.map((message, index) => {
                const showDateSeparator =
                  index === 0 || dayKey(message.timestamp) !== dayKey(filteredOrdered[index - 1].timestamp)
                const showUnreadDivider = unreadDivider?.anchorId === message.id
                return (
                  <div key={message.id} data-msg-id={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center py-2">
                        <span className="text-muted-foreground bg-muted/60 rounded-full px-3 py-1 text-[0.6875rem] font-medium tabular-nums">
                          {new Date(message.timestamp).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {showUnreadDivider && unreadDivider && (
                      <div
                        role="separator"
                        aria-label={`${unreadDivider.count} unread message${unreadDivider.count === 1 ? '' : 's'}`}
                        className="motion-safe:animate-in motion-safe:fade-in flex justify-center py-2 motion-safe:duration-200"
                      >
                        <span className="bg-card text-muted-foreground rounded-full border px-3 py-0.5 text-xs shadow-xs">
                          {`${unreadDivider.count} unread message${unreadDivider.count === 1 ? '' : 's'}`}
                        </span>
                      </div>
                    )}
                    <MessageBubble
                      message={message}
                      chatJid={chat.jid}
                      deviceId={deviceId}
                      onReply={setReplyTarget}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {replyTarget && (
        <div className="bg-muted/50 border-primary/60 flex items-center gap-2.5 border-l-2 px-3.5 py-2 text-sm">
          <Reply className="text-primary size-4 shrink-0" />
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
            size="icon-sm"
            className="text-muted-foreground shrink-0"
            aria-label="Cancel reply"
            onClick={() => setReplyTarget(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <form
        className={cn(
          'flex items-end gap-2 border-t px-3 py-2.5 transition-shadow',
          dragActive && 'ring-primary/40 ring-1',
        )}
        onSubmit={onSend}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Hidden file input with NO `accept` restriction — the validator
            handles type rejection (an empty/unknown MIME falls through to
            /send/file, which is the correct destination for WhatsApp document
            types like .docx that browsers do not always have a MIME mapping
            for). The paperclip button click()es it open. Value is reset on
            send and on cancel so picking the same file twice re-fires
            onChange (a stable value would otherwise swallow the second pick). */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            handlePicked(event.target.files?.[0])
            // Reset immediately so a follow-up pick of the SAME file fires
            // onChange again (the OS picker otherwise no-ops). If validation
            // failed the preview never opened, and if it succeeded the file is
            // already captured in pendingFile — either way the input is free.
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
          className="mb-0.5 shrink-0"
        >
          <Paperclip className="size-5" />
        </Button>
        <textarea
          rows={1}
          className="bg-muted/40 focus-visible:bg-background flex-1 rounded-[1.25rem] border-0 px-4 py-2 focus-visible:ring-1 resize-none outline-none text-sm min-h-[38px] max-h-[120px] chat-scroll field-sizing-content leading-relaxed"
          placeholder="Type a message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (draft.trim() && !sendMutation.isPending) {
                sendMutation.mutate(draft.trim())
              }
            }
          }}
        />
        <Button
          type="submit"
          size="icon-lg"
          className="rounded-full shrink-0"
          aria-label="Send message"
          disabled={sendMutation.isPending || !draft.trim()}
        >
          {sendMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>

      <MediaBurstDialog
        messages={burst.files}
        maxGapLabel={`${mediaBurstGapMin} min`}
        open={burstOpen}
        onOpenChange={setBurstOpen}
        zipName={buildChatZipName({
          identifier: chat.name || jidToPhone(chat.jid),
          timestamp: formatFileTimestamp(),
        })}
      />

      <MediaPreviewDialog
        file={pendingFile}
        chatJid={chat.jid}
        deviceId={deviceId}
        replyTarget={replyTarget}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onSent={onFileSent}
      />
    </div>
  )
}

function DeviceTabButton({
  id,
  active,
  onClick,
  devices,
}: {
  id: string
  active: boolean
  onClick: () => void
  devices?: RegistryDevice[]
}) {
  const [alias, setAlias] = useState(() => {
    return localStorage.getItem(`gowa-ui.device-alias.${id}`) || ''
  })

  useEffect(() => {
    const handleUpdate = () => {
      setAlias(localStorage.getItem(`gowa-ui.device-alias.${id}`) || '')
    }
    window.addEventListener('device-alias-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('device-alias-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [id])

  const dev = devices?.find((d) => d.id === id)
  const displayName = dev?.display_name || dev?.id || id
  const label = alias || displayName

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      className={cn(
        'h-7 px-2.5 text-xs font-mono rounded-full transition-all gap-1.5',
        active ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onClick}
    >
      <span className={cn('size-1.5 rounded-full shrink-0', active ? 'bg-background' : 'bg-muted-foreground')} />
      {label}
    </Button>
  )
}
