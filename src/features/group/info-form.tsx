import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { getGroupInfo } from '@/api/group'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'

export function InfoForm() {
  const [groupId, setGroupId] = useState('')

  const mutation = useActionMutation(getGroupInfo, { successMessage: 'Loaded group info' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({ group_id: groupId })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="info-group-id">Group ID</Label>
        <Input
          id="info-group-id"
          placeholder="120363xxxxxxxxxxxx@g.us"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Get info
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
