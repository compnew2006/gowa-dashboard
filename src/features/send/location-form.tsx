import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { sendLocation } from '@/api/send'
import { RecipientField, type RecipientValue } from '@/components/shared/recipient-field'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'
import { composeJid } from '@/lib/jid'

export function SendLocationForm() {
  const [recipient, setRecipient] = useState<RecipientValue>({ phone: '', type: 'user' })
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  const mutation = useActionMutation(sendLocation, { successMessage: 'Location sent' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      phone: composeJid(recipient.phone, recipient.type),
      latitude,
      longitude,
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <RecipientField value={recipient} onChange={setRecipient} showStatus />
      <div className="flex flex-col gap-2">
        <Label htmlFor="location-latitude">Latitude</Label>
        <Input
          id="location-latitude"
          placeholder="-6.200000"
          value={latitude}
          onChange={(event) => setLatitude(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="location-longitude">Longitude</Label>
        <Input
          id="location-longitude"
          placeholder="106.816666"
          value={longitude}
          onChange={(event) => setLongitude(event.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Send location
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
