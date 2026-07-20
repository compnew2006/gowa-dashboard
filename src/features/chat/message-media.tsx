import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { downloadMedia } from '@/api/message'
import { Button } from '@/components/ui/button'
import { toApiError } from '@/lib/api-error'
import { formatBytes } from '@/lib/format'
import { rerootServerUrl } from '@/lib/url'
import { useAppInfo } from '@/hooks/use-app-info'
import { useConnection } from '@/stores/connection'
import { useTranslation } from '@/stores/i18n'
import type { MessageInfo } from '@/api/chat'

/**
 * Media renderer for a chat bubble. Two paths split by media type:
 *
 * - Inline-preview media (image / video / audio) fires `downloadMedia` on
 *   mount and renders the blob inline once fetched. The TanStack query is
 *   shared with `BurstThumbnail` via the `['media', id, chat_jid, deviceId]`
 *   key, so the burst dialog reuses the cached blob.
 * - Document media (anything else — PDF, .md, .html, .docx, …) renders the
 *   file card IMMEDIATELY from the message metadata the chat list already
 *   returned (`filename` + `file_length`), and fetches the blob ON CLICK.
 *   No mount-time query fires for documents.
 *
 * Why the split: gowa's `/message/<id>/download` endpoint validates
 * `message.ChatJID == phone` after an UNSCOPED `GetMessageByID(id)` lookup
 * (see upstream `src/usecase/message.go`). In a linked / companion-device
 * setup, the same message id is stored on two rows — one per device — and
 * the unscoped lookup returns whichever row SQLite scans first, so the
 * attribution check fails ~50% of the time with the misleading envelope
 * string `message <id> does not belong to chat <jid>`. That is a backend
 * bug we cannot fix from this repo, but we CAN stop surfacing it as a
 * send-failure-looking error inside freshly-sent bubbles: documents have
 * everything the user needs to recognise their send (filename, size) in
 * the message metadata, so the card renders at once and the broken
 * endpoint is only hit when the user actually asks to download.
 */
export function MessageMedia({ message, deviceId }: { message: MessageInfo; deviceId?: string }) {
  const type = message.media_type

  // Document (and any unknown type): the icon card is the user-facing shape.
  // Render it immediately; fetch the blob on click.
  if (type !== 'image' && type !== 'video' && type !== 'audio') {
    return <DocumentCard message={message} deviceId={deviceId} />
  }

  return <InlinePreviewMedia message={message} deviceId={deviceId} />
}

/**
 * Image / video / audio: fetch the blob on mount and render it inline.
 * Reuses the shared `['media', id, chat_jid, deviceId]` query key so the
 * burst dialog and ZIP exporter pick up the cached entry.
 */
function InlinePreviewMedia({ message, deviceId }: { message: MessageInfo; deviceId?: string }) {
  const baseUrl = useConnection((state) => state.baseUrl)
  const { data: info } = useAppInfo()
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ['media', message.id, message.chat_jid, deviceId],
    queryFn: () => downloadMedia(message.id, message.chat_jid, deviceId),
    enabled: true,
    staleTime: Infinity,
    retry: (failureCount, error) => {
      // The "message <id> does not belong to chat <jid>" envelope comes
      // from gowa's unscoped GetMessageByID race (see file header). One
      // delayed retry collapses the transient case; a persistent failure
      // (linked-device attribution clash) still surfaces the muted retry
      // line below — never a red "send failed"-looking string.
      if (failureCount >= 1) return false
      const msg = toApiError(error).message
      return msg.includes('does not belong to chat')
    },
    retryDelay: () => 1_500,
  })

  if (query.isLoading) {
    return <Loader2 className="text-muted-foreground mt-1 size-4 animate-spin" />
  }

  if (query.isError || !query.data) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <p className="text-muted-foreground text-xs">{t('Media not available yet — click retry')}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          aria-label={t('Retry download')}
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RotateCw className={query.isFetching ? 'size-3 animate-spin' : 'size-3'} />
          {t('Retry download')}
        </Button>
      </div>
    )
  }

  const src = rerootServerUrl(baseUrl ?? '', query.data.file_path, info?.base_path ?? '')

  if (message.media_type === 'image') {
    return <img src={src} alt={message.filename || 'Image'} className="mt-1 w-full h-auto max-h-80 object-cover rounded-lg" />
  }

  if (message.media_type === 'video') {
    // No `muted`: the bubble video is interactive (unlike BurstThumbnail's
    // non-interactive thumbnail, which IS muted).
    return <video src={src} controls className="mt-1 w-full h-auto max-h-80 object-cover rounded-lg" />
  }

  return <audio src={src} controls className="mt-1 w-full max-w-xs" />
}

/**
 * Document card. Renders immediately from message metadata (no mount-time
 * network call), and fetches the blob on click. While the fetch is in
 * flight the card shows a spinner; on error it shows a small inline retry
 * affordance ON the card itself — never a separate "send failed"-looking
 * line, because the send did not fail.
 *
 * The click handler mirrors `useMediaExport.fetchBlob` + the synthesized
 * `<a download>` trick from `triggerBrowserDownload`, but inlined here so
 * the card stays a single self-contained component (the export hook is
 * geared to multi-file ZIP/separate flows and would be overkill for one
 * click). Object URL is revoked one tick after the click so the browser
 * has time to start navigating to the blob.
 */
function DocumentCard({ message, deviceId }: { message: MessageInfo; deviceId?: string }) {
  const baseUrl = useConnection((state) => state.baseUrl)
  const { data: info } = useAppInfo()
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const onDownload = async () => {
    if (status === 'loading') return
    setStatus('loading')
    try {
      const meta = await downloadMedia(message.id, message.chat_jid, deviceId)
      const src = rerootServerUrl(baseUrl ?? '', meta.file_path, info?.base_path ?? '')
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`)
      }
      const blob = await response.blob()
      const filename = message.filename || `${message.id}.bin`
      triggerBrowserDownload(blob, filename)
      setStatus('idle')
    } catch (error) {
      // Surface the backend's envelope message via the standard toast path
      // (same as useMediaExport). The card flips to a small retry state so
      // the user sees the failure is recoverable, not a send failure.
      toast.error(toApiError(error).message)
      setStatus('error')
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onDownload}
        disabled={status === 'loading'}
        aria-label={t('Download file')}
        className="block w-full text-start"
      >
        <div className="ring-foreground/10 flex items-center gap-3 rounded-lg p-2.5 ring-1 transition-colors hover:bg-muted/40">
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
            {status === 'loading' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs">{message.filename || t('Download file')}</p>
            <p className="text-muted-foreground font-mono text-xs">
              {formatBytes(message.file_length)}
            </p>
          </div>
        </div>
      </button>
      {status === 'error' && (
        <div className="mt-1 flex items-center gap-2">
          <p className="text-muted-foreground text-xs">{t('Download failed — click to retry')}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            aria-label={t('Retry download')}
            onClick={onDownload}
          >
            <RotateCw className="size-3" />
            {t('Retry download')}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Synthesized <a download> click — the same trick `useMediaExport` uses.
 * Inlined here so `DocumentCard` is self-contained. The anchor is attached
 * to the document, clicked, and removed synchronously; the object URL is
 * revoked on the next tick so the browser has started the navigation.
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
