import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendFile } from '@/api/send'
import { FileOrUrlInput, type FileOrUrl } from '@/components/shared/file-or-url-input'
import { RecipientField, type RecipientValue } from '@/components/shared/recipient-field'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { composeJid } from '@/lib/jid'

export function SendFileForm() {
  const [recipient, setRecipient] = useState<RecipientValue>({ phone: '', type: 'user' })
  const [source, setSource] = useState<FileOrUrl>({ url: '' })
  const [caption, setCaption] = useState('')

  const mutation = useActionMutation(sendFile, { successMessage: 'File sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: composeJid(recipient.phone, recipient.type),
      file: source.file,
      fileUrl: source.url || undefined,
      caption,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <RecipientField value={recipient} onChange={setRecipient} showStatus />
      <FileOrUrlInput label="File" value={source} onChange={setSource} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="file-caption">Caption</Label>
        <Input
          id="file-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send file
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
