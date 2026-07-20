import { useState, type FormEvent } from 'react'
import { audioRequest, sendAudio } from '@/api/send'
import { FormActions } from '@/components/shared/curl-dialog'
import { FileOrUrlInput, type FileOrUrl } from '@/components/shared/file-or-url-input'
import { ResultPanel } from '@/components/shared/result-panel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export function SendAudioForm() {
  const jid = useRecipientJid()
  const [source, setSource] = useState<FileOrUrl>({ url: '' })
  const [ptt, setPtt] = useState(false)
  const [replyId, setReplyId] = useState('')

  const mutation = useActionMutation(sendAudio, { successMessage: 'Audio sent' })

  const payload = {
    phone: jid,
    file: source.file,
    fileUrl: source.url || undefined,
    ptt,
    reply_message_id: replyId || undefined,
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate(payload)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FileOrUrlInput label="Audio" accept="audio/*" value={source} onChange={setSource} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="audio-reply">Reply to message ID (optional)</Label>
        <Input
          id="audio-reply"
          value={replyId}
          onChange={(event) => setReplyId(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={ptt} onCheckedChange={setPtt} />
        Send as voice note (PTT)
      </label>
      <FormActions
        submitLabel="Send audio"
        pending={mutation.isPending}
        disabled={!jid}
        request={audioRequest(payload)}
      />
      <ResultPanel result={mutation.data} />
    </form>
  )
}
