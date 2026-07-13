import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendChatPresence } from '@/api/send'
import { RecipientField, type RecipientValue } from '@/components/shared/recipient-field'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { composeJid } from '@/lib/jid'

export function SendChatPresenceForm() {
  const [recipient, setRecipient] = useState<RecipientValue>({ phone: '', type: 'user' })
  const [action, setAction] = useState('start')

  const mutation = useActionMutation(sendChatPresence, { successMessage: 'Chat presence sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: composeJid(recipient.phone, recipient.type),
      action,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <RecipientField value={recipient} onChange={setRecipient} showStatus />
      <div className="flex flex-col gap-2">
        <Label>Action</Label>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="start">Start typing</SelectItem>
            <SelectItem value="stop">Stop typing</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send chat presence
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
