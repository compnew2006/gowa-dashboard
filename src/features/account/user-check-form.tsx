import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { checkUser } from '@/api/user'
import { RecipientField, type RecipientValue } from '@/components/shared/recipient-field'
import { Button } from '@/components/ui/button'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { composeJid } from '@/lib/jid'
import { cn } from '@/lib/utils'

export function UserCheckForm() {
  const [recipient, setRecipient] = useState<RecipientValue>({ phone: '', type: 'user' })
  const mutation = useActionMutation(checkUser, { successMessage: 'Check completed' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate(composeJid(recipient.phone, recipient.type))
  }

  const onWhatsApp = mutation.data?.is_on_whatsapp

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <RecipientField value={recipient} onChange={setRecipient} />
      <Button
        type="submit"
        disabled={mutation.isPending || !recipient.phone.trim()}
        className="self-start"
      >
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Check
      </Button>
      {mutation.data && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border p-3 text-sm font-medium',
            onWhatsApp
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          {onWhatsApp ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {onWhatsApp ? 'User is on WhatsApp' : 'User is not on WhatsApp'}
        </div>
      )}
    </form>
  )
}
