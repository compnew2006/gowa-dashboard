import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendSticker } from '@/api/send'
import { FileOrUrlInput, type FileOrUrl } from '@/components/shared/file-or-url-input'
import { RecipientField, type RecipientValue } from '@/components/shared/recipient-field'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { composeJid } from '@/lib/jid'

export function SendStickerForm() {
  const [recipient, setRecipient] = useState<RecipientValue>({ phone: '', type: 'user' })
  const [source, setSource] = useState<FileOrUrl>({ url: '' })

  const mutation = useActionMutation(sendSticker, { successMessage: 'Sticker sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: composeJid(recipient.phone, recipient.type),
      file: source.file,
      fileUrl: source.url || undefined,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <RecipientField value={recipient} onChange={setRecipient} showStatus />
      <FileOrUrlInput label="Sticker" accept="image/*" value={source} onChange={setSource} />
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send sticker
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
