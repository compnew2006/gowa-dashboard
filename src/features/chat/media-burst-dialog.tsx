import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Music } from 'lucide-react'
import { downloadMedia } from '@/api/message'
import type { MessageInfo } from '@/api/chat'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppInfo } from '@/hooks/use-app-info'
import { useConnection } from '@/stores/connection'
import { useMediaExport } from '@/hooks/use-media-export'
import { formatBytes } from '@/lib/format'
import { rerootServerUrl } from '@/lib/url'
import { cn } from '@/lib/utils'

export function MediaBurstDialog({
  messages,
  maxGapLabel,
  open,
  onOpenChange,
  zipName,
  deviceId,
}: {
  messages: readonly MessageInfo[]
  maxGapLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  zipName: string
  deviceId?: string
}) {
  const exporter = useMediaExport(deviceId)
  const empty = messages.length === 0

  const handleZip = async () => {
    await exporter.downloadAsZip(messages, zipName)
    onOpenChange(false)
  }

  const handleSeparate = async () => {
    await exporter.downloadSeparately(messages)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Recent media</DialogTitle>
            <span className="text-muted-foreground font-mono text-xs">{maxGapLabel}</span>
          </div>
        </DialogHeader>

        {empty ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No media in the latest burst
          </p>
        ) : (
          <ul className="divide-border max-h-96 divide-y overflow-y-auto">
            {messages.map((message) => (
              <li key={message.id} className="flex items-center gap-3 py-2">
                <BurstThumbnail message={message} enabled={open} deviceId={deviceId} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{message.filename || 'untitled'}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {formatBytes(message.file_length)}
                  </p>
                </div>
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                  {message.media_type}
                </span>
              </li>
            ))}
          </ul>
        )}

        {exporter.isDownloading && (
          <div className="space-y-1">
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-[width] duration-200"
                style={{ width: `${exporter.progress}%` }}
              />
            </div>
            <p className="text-muted-foreground text-right text-xs">
              {`${Math.round((exporter.progress / 100) * messages.length)} of ${messages.length} files`}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={exporter.isDownloading}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleSeparate}
            disabled={empty || exporter.isDownloading}
          >
            Download separately
          </Button>
          <Button onClick={handleZip} disabled={empty || exporter.isDownloading}>
            Download as ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Lazily resolves a thumbnail for image/video messages using the same
 * two-step path `MessageMedia` uses: `downloadMedia` then `rerootServerUrl` on
 * `file_path`. Documents/audio render a small icon. The query is only enabled
 * while the parent dialog is open so opening and closing the dialog does not
 * fan out network work.
 */
function BurstThumbnail({ message, enabled, deviceId }: { message: MessageInfo; enabled: boolean; deviceId?: string }) {
  const baseUrl = useConnection((state) => state.baseUrl)
  const { data: info } = useAppInfo()
  const [errored, setErrored] = useState(false)

  const showRemote = enabled && (message.media_type === 'image' || message.media_type === 'video')
  const query = useQuery({
    queryKey: ['media', message.id, message.chat_jid, deviceId],
    queryFn: () => downloadMedia(message.id, message.chat_jid, deviceId),
    enabled: showRemote,
    staleTime: Infinity,
    retry: false,
  })

  useEffect(() => {
    setErrored(false)
  }, [message.id])

  const src =
    query.data && !errored
      ? rerootServerUrl(baseUrl ?? '', query.data.file_path, info?.base_path ?? '')
      : null

  if (src && message.media_type === 'image') {
    return (
      <img
        src={src}
        alt={message.filename}
        onError={() => setErrored(true)}
        className={cn('ring-foreground/10 size-10 shrink-0 rounded-md object-cover ring-1')}
      />
    )
  }
  if (src && message.media_type === 'video') {
    return (
      <video
        src={src}
        onError={() => setErrored(true)}
        className={cn('ring-foreground/10 size-10 shrink-0 rounded-md object-cover ring-1')}
        muted
      />
    )
  }
  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground ring-foreground/10 flex size-10 shrink-0 items-center justify-center rounded-md ring-1',
      )}
    >
      {message.media_type === 'audio' ? (
        <Music className="size-4" />
      ) : (
        <FileText className="size-4" />
      )}
    </span>
  )
}
