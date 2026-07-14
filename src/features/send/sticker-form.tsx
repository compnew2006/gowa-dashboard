import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendSticker } from '@/api/send'
import { FileOrUrlInput, type FileOrUrl } from '@/components/shared/file-or-url-input'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export function SendStickerForm() {
  const jid = useRecipientJid()
  const [source, setSource] = useState<FileOrUrl>({ url: '' })

  const mutation = useActionMutation(sendSticker, { successMessage: 'Sticker sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: jid,
      file: source.file,
      fileUrl: source.url || undefined,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FileOrUrlInput label="Sticker" accept="image/*" value={source} onChange={setSource} />
      <Button type="submit" disabled={mutation.isPending || !jid} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send sticker
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
