import { useState, type FormEvent } from 'react'
import { stickerRequest, sendSticker } from '@/api/send'
import { FormActions } from '@/components/shared/curl-dialog'
import { FileOrUrlInput, type FileOrUrl } from '@/components/shared/file-or-url-input'
import { ResultPanel } from '@/components/shared/result-panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export function SendStickerForm() {
  const jid = useRecipientJid()
  const [source, setSource] = useState<FileOrUrl>({ url: '' })
  const [replyId, setReplyId] = useState('')

  const mutation = useActionMutation(sendSticker, { successMessage: 'Sticker sent' })

  const payload = {
    phone: jid,
    file: source.file,
    fileUrl: source.url || undefined,
    reply_message_id: replyId || undefined,
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate(payload)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FileOrUrlInput label="Sticker" accept="image/*" value={source} onChange={setSource} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="sticker-reply">Reply to message ID (optional)</Label>
        <Input
          id="sticker-reply"
          value={replyId}
          onChange={(event) => setReplyId(event.target.value)}
        />
      </div>
      <FormActions
        submitLabel="Send sticker"
        pending={mutation.isPending}
        disabled={!jid}
        request={stickerRequest(payload)}
      />
      <ResultPanel result={mutation.data} />
    </form>
  )
}
