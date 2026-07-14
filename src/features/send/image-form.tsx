import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendImage } from '@/api/send'
import { FileOrUrlInput, type FileOrUrl } from '@/components/shared/file-or-url-input'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export function SendImageForm() {
  const jid = useRecipientJid()
  const [source, setSource] = useState<FileOrUrl>({ url: '' })
  const [caption, setCaption] = useState('')
  const [viewOnce, setViewOnce] = useState(false)
  const [compress, setCompress] = useState(true)

  const mutation = useActionMutation(sendImage, { successMessage: 'Image sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: jid,
      file: source.file,
      fileUrl: source.url || undefined,
      caption,
      view_once: viewOnce,
      compress,
      // view_once messages cannot be forwarded per the WhatsApp protocol
      is_forwarded: false,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FileOrUrlInput label="Image" accept="image/*" value={source} onChange={setSource} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="image-caption">Caption</Label>
        <Input
          id="image-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={viewOnce} onCheckedChange={setViewOnce} />
        View once
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={compress} onCheckedChange={setCompress} />
        Compress
      </label>
      <Button type="submit" disabled={mutation.isPending || !jid} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send image
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
