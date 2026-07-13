import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendLink } from '@/api/send'
import { RecipientField, type RecipientValue } from '@/components/shared/recipient-field'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { composeJid } from '@/lib/jid'

export function SendLinkForm() {
  const [recipient, setRecipient] = useState<RecipientValue>({ phone: '', type: 'user' })
  const [link, setLink] = useState('')
  const [caption, setCaption] = useState('')

  const mutation = useActionMutation(sendLink, { successMessage: 'Link sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: composeJid(recipient.phone, recipient.type),
      link,
      caption,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <RecipientField value={recipient} onChange={setRecipient} showStatus />
      <div className="flex flex-col gap-2">
        <Label htmlFor="link-url">Link</Label>
        <Input
          id="link-url"
          placeholder="https://example.com"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="link-caption">Caption</Label>
        <Input
          id="link-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send link
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
