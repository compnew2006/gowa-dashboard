import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendPresence } from '@/api/send'
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

export function SendPresenceForm() {
  const [type, setType] = useState('available')

  const mutation = useActionMutation(sendPresence, { successMessage: 'Presence updated' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({ type })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label>Presence</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Update presence
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
