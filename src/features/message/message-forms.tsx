import { useState, type FormEvent, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  deleteMessage,
  forwardMessage,
  markRead,
  reactMessage,
  revokeMessage,
  starMessage,
  unstarMessage,
  updateMessage,
} from '@/api/message'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { useRecipientJid } from '@/stores/recipient'

export interface MessageActionProps {
  messageId: string
}

/** Shared shell: submit + result. Recipient and message ID come from the workspace. */
function MessageActionForm<TData>({
  messageId,
  submitLabel,
  successMessage,
  run,
  children,
  extraValid = true,
}: MessageActionProps & {
  submitLabel: string
  successMessage: string
  run: (messageId: string, phone: string) => Promise<TData>
  children?: ReactNode
  extraValid?: boolean
}) {
  const jid = useRecipientJid()
  const mutation = useActionMutation((vars: { messageId: string; phone: string }) =>
    run(vars.messageId, vars.phone),
  )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({ messageId: messageId.trim(), phone: jid })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {children}
      <Button
        type="submit"
        disabled={mutation.isPending || !messageId.trim() || !jid || !extraValid}
        className="self-start"
      >
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
      {mutation.isSuccess && <ResultPanel result={{ status: successMessage }} />}
    </form>
  )
}

export function ReactForm({ messageId }: MessageActionProps) {
  const [emoji, setEmoji] = useState('')
  return (
    <MessageActionForm
      messageId={messageId}
      submitLabel="Send reaction"
      successMessage="Reaction sent"
      extraValid={emoji.trim().length > 0}
      run={(id, phone) => reactMessage(id, { phone, emoji })}
    >
      <div className="flex flex-col gap-2">
        <Label>Emoji</Label>
        <Input
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          placeholder="👍 (empty removes the reaction)"
        />
      </div>
    </MessageActionForm>
  )
}

export function UpdateForm({ messageId }: MessageActionProps) {
  const [message, setMessage] = useState('')
  return (
    <MessageActionForm
      messageId={messageId}
      submitLabel="Update message"
      successMessage="Message updated"
      extraValid={message.trim().length > 0}
      run={(id, phone) => updateMessage(id, { phone, message })}
    >
      <div className="flex flex-col gap-2">
        <Label>New text</Label>
        <Textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
      </div>
    </MessageActionForm>
  )
}

export function DeleteForm({ messageId }: MessageActionProps) {
  return (
    <MessageActionForm
      messageId={messageId}
      submitLabel="Delete for everyone"
      successMessage="Message deleted"
      run={(id, phone) => deleteMessage(id, { phone })}
    />
  )
}

export function RevokeForm({ messageId }: MessageActionProps) {
  return (
    <MessageActionForm
      messageId={messageId}
      submitLabel="Revoke message"
      successMessage="Message revoked"
      run={(id, phone) => revokeMessage(id, { phone })}
    />
  )
}

export function ReadForm({ messageId }: MessageActionProps) {
  return (
    <MessageActionForm
      messageId={messageId}
      submitLabel="Mark as read"
      successMessage="Marked as read"
      run={(id, phone) => markRead(id, { phone })}
    />
  )
}

export function StarForm({ messageId }: MessageActionProps) {
  const [starred, setStarred] = useState(true)
  return (
    <MessageActionForm
      messageId={messageId}
      submitLabel={starred ? 'Star message' : 'Unstar message'}
      successMessage={starred ? 'Message starred' : 'Message unstarred'}
      run={(id, phone) => (starred ? starMessage(id, { phone }) : unstarMessage(id, { phone }))}
    >
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={starred ? 'default' : 'outline'}
          onClick={() => setStarred(true)}
        >
          Star
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!starred ? 'default' : 'outline'}
          onClick={() => setStarred(false)}
        >
          Unstar
        </Button>
      </div>
    </MessageActionForm>
  )
}

export function ForwardForm({ messageId }: MessageActionProps) {
  const [reupload, setReupload] = useState(false)
  return (
    <MessageActionForm
      messageId={messageId}
      submitLabel="Forward message"
      successMessage="Message forwarded"
      run={(id, phone) => forwardMessage(id, { phone, force_reupload: reupload })}
    >
      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={reupload}
          onChange={(event) => setReupload(event.target.checked)}
        />
        Force re-upload media
      </label>
    </MessageActionForm>
  )
}
