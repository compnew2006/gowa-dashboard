import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendContact } from '@/api/send'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export function SendContactForm() {
  const jid = useRecipientJid()
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const mutation = useActionMutation(sendContact, { successMessage: 'Contact sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: jid,
      contact_name: contactName,
      contact_phone: contactPhone,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">Contact name</Label>
        <Input
          id="contact-name"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-phone">Contact phone</Label>
        <Input
          id="contact-phone"
          placeholder="628xxxxxxxxxx"
          value={contactPhone}
          onChange={(event) => setContactPhone(event.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={mutation.isPending || !jid} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send contact
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
