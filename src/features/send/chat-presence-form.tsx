import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendChatPresence } from '@/api/send'
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
import { useRecipientJid } from '@/stores/recipient'

export function SendChatPresenceForm() {
  const jid = useRecipientJid()
  const [action, setAction] = useState('start')

  const mutation = useActionMutation(sendChatPresence, { successMessage: 'Chat presence sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: jid,
      action,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
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
      <Button type="submit" disabled={mutation.isPending || !jid} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send chat presence
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
