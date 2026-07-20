import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2, RotateCw } from 'lucide-react'
import { downloadMedia } from '@/api/message'
import { Button } from '@/components/ui/button'
import { toApiError } from '@/lib/api-error'
import { formatBytes } from '@/lib/format'
import { rerootServerUrl } from '@/lib/url'
import { useAppInfo } from '@/hooks/use-app-info'
import { useConnection } from '@/stores/connection'
import type { MessageInfo } from '@/api/chat'

/**
 * Downloads media for a message on mount and renders it inline once fetched.
 * The per-message query IS the background prefetch — every visible media
 * message fetches its blob on mount, so the operator sees the preview with no
 * click and the blob is already in the TanStack cache (shared with
 * `BurstThumbnail` via the `['media', message.id, message.chat_jid]` key) when
 * they later open the burst dialog or click "Download as ZIP".
 */
export function MessageMedia({ message, deviceId }: { message: MessageInfo; deviceId?: string }) {
  const baseUrl = useConnection((state) => state.baseUrl)
  const { data: info } = useAppInfo()

  const query = useQuery({
    queryKey: ['media', message.id, message.chat_jid, deviceId],
    queryFn: () => downloadMedia(message.id, message.chat_jid, deviceId),
    enabled: true,
    staleTime: Infinity,
    retry: false,
  })

  if (query.isLoading) {
    return <Loader2 className="text-muted-foreground mt-1 size-4 animate-spin" />
  }

  if (query.isError || !query.data) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <p className="text-destructive text-xs">
          {query.error ? toApiError(query.error).message : 'Download failed'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          aria-label="Retry download"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RotateCw className={query.isFetching ? 'size-3 animate-spin' : 'size-3'} />
          Retry download
        </Button>
      </div>
    )
  }

  const src = rerootServerUrl(baseUrl ?? '', query.data.file_path, info?.base_path ?? '')
  const type = message.media_type

  if (type === 'image') {
    return <img src={src} alt={message.filename || 'Image'} className="mt-1 w-full h-auto max-h-80 object-cover rounded-lg" />
  }

  if (type === 'video') {
    // No `muted`: the bubble video is interactive (unlike BurstThumbnail's
    // non-interactive thumbnail, which IS muted).
    return <video src={src} controls className="mt-1 w-full h-auto max-h-80 object-cover rounded-lg" />
  }

  if (type === 'audio') {
    return <audio src={src} controls className="mt-1 w-full max-w-xs" />
  }

  // Document (everything else): compact card mirroring the picked-file card in
  // media-preview-dialog.tsx. Plain <div>, NOT a <Card> — the bubble is already
  // card-shaped (DESIGN.md no-nested-cards). ring-1 ring-foreground/10 is the
  // flat-by-default rest state; no shadow. The <a> wrapper is the click target
  // (cursor is the hover affordance); download triggers a save, target=_blank
  // + rel=noopener noreferrer is the tab-nabbing-safe fallback.
  return (
    <a
      href={src}
      download={message.filename || undefined}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="ring-foreground/10 mt-1 flex items-center gap-3 rounded-lg p-2.5 ring-1">
        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs">{message.filename || 'Download file'}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {formatBytes(message.file_length)}
          </p>
        </div>
      </div>
    </a>
  )
}
