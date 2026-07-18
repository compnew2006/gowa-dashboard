import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Music, Terminal } from 'lucide-react'
import type { ApiRequest } from '@/api/request'
import type { MessageInfo } from '@/api/chat'
import {
  audioRequest,
  fileRequest,
  imageRequest,
  sendAudio,
  sendFile,
  sendImage,
  sendVideo,
  videoRequest,
  type MediaPayload,
  type SendResult,
} from '@/api/send'
import { Button } from '@/components/ui/button'
import { CurlDialog } from '@/components/shared/curl-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { canHaveCaption, classifyMedia, type MediaKind } from '@/lib/media-classify'
import { formatBytes } from '@/lib/format'

const TITLE_BY_KIND: Record<MediaKind, string> = {
  image: 'Send image',
  video: 'Send video',
  audio: 'Send audio',
  file: 'Send file',
}

interface SendArgs {
  file: File
  caption: string
  replyTarget: MessageInfo | null
}

/**
 * Build the matched multipart ApiRequest for a picked file. The `*Request`
 * builders in `api/send.ts` are reused verbatim — no new builder is added — so
 * the cURL preview the operator sees in the dialog footer is byte-identical to
 * the request `sendImage`/`sendVideo`/`sendAudio`/`sendFile` will fire. The
 * transport-only `deviceId` is intentionally NOT threaded into the request
 * body (the builders already exclude it; it rides on the `X-Device-Id` header
 * via the executor). `phone` is the chat JID — the chat viewer's hard
 * invariant, never the global recipient store.
 */
function buildRequest(
  kind: MediaKind,
  file: File,
  chatJid: string,
  caption: string,
  replyTarget: MessageInfo | null,
): ApiRequest {
  const replyMessageId = replyTarget?.id || undefined
  switch (kind) {
    case 'image':
      return imageRequest({ phone: chatJid, file, caption, reply_message_id: replyMessageId })
    case 'video':
      return videoRequest({ phone: chatJid, file, caption, reply_message_id: replyMessageId })
    case 'audio':
      return audioRequest({ phone: chatJid, file, reply_message_id: replyMessageId })
    case 'file':
      return fileRequest({ phone: chatJid, file, caption, reply_message_id: replyMessageId })
  }
}

/**
 * Fire the matched executor for a picked file. `chatJid` is threaded as
 * `phone` (chat viewer invariant); `deviceId` rides on the payload so the F2
 * `X-Device-Id` header override scopes the send to this conversation's device
 * (in All-devices mode the row's device; in This-device mode the global
 * `useDeviceStore` value, which the override then no-ops on because it equals
 * what the interceptor would set anyway). Audio omits the caption field per
 * gowa's `/send/audio` contract.
 */
function sendMatched(
  kind: MediaKind,
  args: SendArgs,
  chatJid: string,
  deviceId: string,
): Promise<SendResult> {
  const replyMessageId = args.replyTarget?.id || undefined
  const base: MediaPayload = {
    phone: chatJid,
    file: args.file,
    reply_message_id: replyMessageId,
    deviceId,
  }
  switch (kind) {
    case 'image':
      return sendImage({ ...base, caption: args.caption })
    case 'video':
      return sendVideo({ ...base, caption: args.caption })
    case 'audio':
      return sendAudio(base)
    case 'file':
      return sendFile({ ...base, caption: args.caption })
  }
}

export function MediaPreviewDialog({
  file,
  chatJid,
  deviceId,
  replyTarget,
  open,
  onOpenChange,
  onSent,
}: {
  file: File | null
  chatJid: string
  deviceId: string
  replyTarget: MessageInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}) {
  const kind = useMemo<MediaKind>(() => (file ? classifyMedia(file) : 'file'), [file])
  const allowCaption = canHaveCaption(kind)
  const [caption, setCaption] = useState('')
  const [curlOpen, setCurlOpen] = useState(false)
  // Object URL lifecycle. Created when the dialog opens with a file, revoked
  // when it closes (and on unmount) — the Vue reference's `URL.revokeObjectURL`
  // cleanup is mandatory to avoid leaks across many previews in a session.
  const objectUrlRef = useRef<string | null>(null)

  // Create the object URL while the dialog is open; revoke on close or
  // unmount. The ref holds the URL we currently own so the cleanup is robust
  // to the file prop changing while open.
  useEffect(() => {
    if (open && file && !objectUrlRef.current) {
      objectUrlRef.current = URL.createObjectURL(file)
    }
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [file, open])

  // Clear the caption whenever a new file lands so a stale caption from a
  // prior pick does not silently attach to the next send.
  useEffect(() => {
    setCaption('')
  }, [file])

  const request = useMemo(
    () => (file ? buildRequest(kind, file, chatJid, caption, replyTarget) : null),
    [file, kind, chatJid, caption, replyTarget],
  )

  // useActionMutation (over useMutation) so `onSuccess` is honored and the
  // success/error toast dance is reused. On success we delegate to the
  // parent's `onSent`, which is where the four-concern auto-scroll machinery
  // lives (arming stickToBottomRef, clearing the reply target, invalidating
  // ['chat-messages', deviceId, chat.jid]). The dialog stays open on error so
  // the operator can retry without re-picking the file.
  const sendMutation = useActionMutation(
    (args: SendArgs) => sendMatched(kind, args, chatJid, deviceId),
    {
      successMessage: 'File sent',
      onSuccess: () => {
        onSent()
      },
    },
  )

  const handleSubmit = () => {
    if (!file) return
    sendMutation.mutate({ file, caption: allowCaption ? caption : '', replyTarget })
  }

  const previewSrc = objectUrlRef.current
  const title = file ? TITLE_BY_KIND[kind] : 'Send file'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* Plain <div>, NOT a <Card> — DESIGN.md no-nested-cards. The body
              is the file preview: image <img>, video <video controls>, or a
              compact icon + filename + size row for audio/documents. */}
          <div className="flex flex-col gap-3">
            {file && kind === 'image' && previewSrc && (
              <img src={previewSrc} alt={file.name} className="max-h-80 w-auto rounded-lg" />
            )}
            {file && kind === 'video' && previewSrc && (
              <video src={previewSrc} controls className="max-h-80 w-auto rounded-lg" />
            )}
            {file && (kind === 'audio' || kind === 'file') && (
              <div className="ring-foreground/10 flex items-center gap-3 rounded-lg p-3 ring-1">
                <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                  {kind === 'audio' ? (
                    <Music className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{file.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
            )}

            {file && allowCaption && (
              <Textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Caption (optional)"
                className="text-sm"
                rows={3}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurlOpen(true)}
              disabled={!request}
              aria-label="Show cURL command"
            >
              <Terminal className="size-4" />
              cURL
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={sendMutation.isPending || !file} onClick={handleSubmit}>
              {sendMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Send file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {request && <CurlDialog request={request} open={curlOpen} onOpenChange={setCurlOpen} />}
    </>
  )
}
