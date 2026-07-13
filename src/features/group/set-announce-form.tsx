import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { setGroupAnnounce } from '@/api/group'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useActionMutation } from '@/hooks/use-action-mutation'

export function SetAnnounceForm() {
  const [groupId, setGroupId] = useState('')
  const [announce, setAnnounce] = useState(false)

  const mutation = useActionMutation(setGroupAnnounce, { successMessage: 'Announce mode updated' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({ group_id: groupId, announce })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="set-announce-group-id">Group ID</Label>
        <Input
          id="set-announce-group-id"
          placeholder="120363xxxxxxxxxxxx@g.us"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={announce} onCheckedChange={setAnnounce} />
        Announce mode (only admins can send messages)
      </label>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Update announce
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
