import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { getGroupInviteLink } from '@/api/group'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useActionMutation } from '@/hooks/use-action-mutation'

export function InviteLinkForm() {
  const [groupId, setGroupId] = useState('')
  const [reset, setReset] = useState(false)

  const mutation = useActionMutation(getGroupInviteLink, {
    successMessage: 'Loaded invite link',
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({ group_id: groupId, reset })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-group-id">Group ID</Label>
        <Input
          id="invite-group-id"
          placeholder="120363xxxxxxxxxxxx@g.us"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={reset} onCheckedChange={setReset} />
        Reset link (revokes the previous one)
      </label>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Get invite link
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
