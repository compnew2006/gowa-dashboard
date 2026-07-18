import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { downloadMedia } from '@/api/message'
import type { MessageInfo } from '@/api/chat'
import { useAppInfo } from '@/hooks/use-app-info'
import { useConnection } from '@/stores/connection'
import { toApiError } from '@/lib/api-error'
import { buildMediaZip, sanitizeZipFilename, type MediaZipEntry } from '@/lib/zip'
import { rerootServerUrl } from '@/lib/url'

const ZIP_FALLBACK = 'media.bin'

export interface MediaExport {
  downloadAsZip: (messages: readonly MessageInfo[], zipName: string) => Promise<void>
  downloadSeparately: (messages: readonly MessageInfo[]) => Promise<void>
  redownload: (message: MessageInfo) => Promise<void>
  isDownloading: boolean
  progress: number
  redownloadingIds: Set<string>
}

/**
 * Coordinates multi-file downloads of received media. Each download follows
 * the exact two-step path `MessageMedia` uses: call `downloadMedia` to get the
 * signed/rerooted URL, then `fetch()` the bytes at that URL (the server
 * populates `file_url` from the Host header, so `rerootServerUrl` is applied to
 * `file_path` exactly as the inline renderer does). The blob is then either
 * bundled into a single ZIP via `buildMediaZip` or saved individually through a
 * synthesized `<a download>` click.
 *
 * Progress is a count fraction (0/N, 1/N, ... N/N * 100) rather than byte
 * progress because `fetch()` does not expose byte progress without streams,
 * and count-by-total is the honest signal at this surface.
 *
 * This is a non-mutation flow, so errors go through `toast.error` directly
 * rather than `useActionMutation` (whose onSuccess/onError contract is for
 * form mutations only).
 */
export function useMediaExport(): MediaExport {
  const baseUrl = useConnection((state) => state.baseUrl)
  const { data: info } = useAppInfo()

  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [redownloadingIds, setRedownloadingIds] = useState<Set<string>>(() => new Set())
  // baseUrl/base_path are read fresh on each call; keeping the latest values in
  // a ref avoids re-creating the callbacks (and re-rendering consumers) every
  // time the connection store flips while a download is in flight.
  const ctxRef = useRef({ baseUrl, basePath: info?.base_path ?? '' })
  ctxRef.current = { baseUrl, basePath: info?.base_path ?? '' }

  const fetchBlob = useCallback(async (message: MessageInfo): Promise<Blob> => {
    const { baseUrl: b, basePath } = ctxRef.current
    const meta = await downloadMedia(message.id, message.chat_jid)
    const src = rerootServerUrl(b ?? '', meta.file_path, basePath)
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`Download failed (${response.status}) for ${message.id}`)
    }
    return response.blob()
  }, [])

  const runBatch = useCallback(
    async (
      messages: readonly MessageInfo[],
      onBlob: (message: MessageInfo, blob: Blob) => void,
    ) => {
      if (messages.length === 0) return
      setIsDownloading(true)
      setProgress(0)
      let fetched = 0
      try {
        for (const message of messages) {
          const blob = await fetchBlob(message)
          onBlob(message, blob)
          fetched += 1
          setProgress(Math.round((fetched / messages.length) * 100))
        }
      } catch (error) {
        toast.error(toApiError(error).message)
        throw error
      } finally {
        setIsDownloading(false)
      }
    },
    [fetchBlob],
  )

  const downloadSeparately = useCallback(
    async (messages: readonly MessageInfo[]) => {
      try {
        await runBatch(messages, (message, blob) => {
          const name = sanitizeZipFilename(message.filename, ZIP_FALLBACK)
          triggerBrowserDownload(blob, name)
        })
      } catch {
        // toast.error already fired in runBatch; nothing more to do here.
      }
    },
    [runBatch],
  )

  const downloadAsZip = useCallback(
    async (messages: readonly MessageInfo[], zipName: string) => {
      const entries: MediaZipEntry[] = []
      const used = new Map<string, number>()
      try {
        await runBatch(messages, (message, blob) => {
          const base = sanitizeZipFilename(message.filename, ZIP_FALLBACK)
          const unique = dedupeName(base, used)
          entries.push({ filename: unique, blob })
        })
        if (entries.length === 0) return
        const zip = await buildMediaZip(entries)
        triggerBrowserDownload(zip, zipName)
      } catch {
        // toast.error already fired in runBatch; nothing more to do here.
      }
    },
    [runBatch],
  )

  const redownload = useCallback(
    async (message: MessageInfo) => {
      setRedownloadingIds((prev) => {
        const next = new Set(prev)
        next.add(message.id)
        return next
      })
      try {
        const blob = await fetchBlob(message)
        const name = sanitizeZipFilename(message.filename, ZIP_FALLBACK)
        triggerBrowserDownload(blob, name)
      } catch (error) {
        toast.error(toApiError(error).message)
      } finally {
        setRedownloadingIds((prev) => {
          const next = new Set(prev)
          next.delete(message.id)
          return next
        })
      }
    },
    [fetchBlob],
  )

  return {
    downloadAsZip,
    downloadSeparately,
    redownload,
    isDownloading,
    progress,
    redownloadingIds,
  }
}

/**
 * Resolve a basename to a unique entry name within the ZIP by appending
 * ` (n)` before the extension when a prior entry already used the same name.
 * Returns the input unchanged on first use. Pure on `used` so it is testable
 * without JSZip.
 */
function dedupeName(basename: string, used: Map<string, number>): string {
  const count = used.get(basename) ?? 0
  used.set(basename, count + 1)
  if (count === 0) return basename
  const dot = basename.lastIndexOf('.')
  const stem = dot > 0 ? basename.slice(0, dot) : basename
  const ext = dot > 0 ? basename.slice(dot) : ''
  return `${stem} (${count})${ext}`
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Defer revoke one tick so the browser has started navigating to the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
