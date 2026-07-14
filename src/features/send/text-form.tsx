import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendText } from '@/api/send'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export function SendTextForm() {
  const jid = useRecipientJid()
  const [message, setMessage] = useState('')
  const [replyId, setReplyId] = useState('')

  const mutation = useActionMutation(sendText, { successMessage: 'Message sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: jid,
      message,
      reply_message_id: replyId || undefined,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="text-message">Message</Label>
        <Textarea
          id="text-message"
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="text-reply">Reply to message ID (optional)</Label>
        <Input
          id="text-reply"
          value={replyId}
          onChange={(event) => setReplyId(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending || !jid} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send message
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
