import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendAudio } from '@/api/send'
import { FileOrUrlInput, type FileOrUrl } from '@/components/shared/file-or-url-input'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export function SendAudioForm() {
  const jid = useRecipientJid()
  const [source, setSource] = useState<FileOrUrl>({ url: '' })
  const [ptt, setPtt] = useState(false)

  const mutation = useActionMutation(sendAudio, { successMessage: 'Audio sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: jid,
      file: source.file,
      fileUrl: source.url || undefined,
      ptt,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FileOrUrlInput label="Audio" accept="audio/*" value={source} onChange={setSource} />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={ptt} onCheckedChange={setPtt} />
        Send as voice note (PTT)
      </label>
      <Button type="submit" disabled={mutation.isPending || !jid} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send audio
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
