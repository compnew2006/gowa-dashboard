import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  addParticipants,
  demoteParticipants,
  promoteParticipants,
  removeParticipants,
  type ParticipantsPayload,
  type ParticipantStatus,
} from '@/api/group'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActionMutation } from '@/hooks/use-action-mutation'

type ParticipantAction = 'add' | 'remove' | 'promote' | 'demote'

const actions: Record<
  ParticipantAction,
  (payload: ParticipantsPayload) => Promise<ParticipantStatus[]>
> = {
  add: addParticipants,
  remove: removeParticipants,
  promote: promoteParticipants,
  demote: demoteParticipants,
}

/** Split a textarea into a trimmed list, one entry per line or comma. */
function parseList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function ParticipantsForm() {
  const queryClient = useQueryClient()
  const [groupId, setGroupId] = useState('')
  const [participants, setParticipants] = useState('')
  const [active, setActive] = useState<ParticipantAction | null>(null)

  const mutation = useActionMutation(
    ({ action, ...payload }: ParticipantsPayload & { action: ParticipantAction }) =>
      actions[action](payload),
    {
      successMessage: 'Participants updated',
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['groups'] }),
    },
  )

  const run = (action: ParticipantAction) => {
    setActive(action)
    mutation.mutate({ action, group_id: groupId, participants: parseList(participants) })
  }

  const spinner = (action: ParticipantAction) =>
    mutation.isPending && active === action ? <Loader2 className="size-4 animate-spin" /> : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="participants-group-id">Group ID</Label>
        <Input
          id="participants-group-id"
          placeholder="120363xxxxxxxxxxxx@g.us"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="participants-list">Participants</Label>
        <Textarea
          id="participants-list"
          rows={4}
          placeholder="628xxxxxxxxxx, one per line or comma-separated"
          value={participants}
          onChange={(event) => setParticipants(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => run('add')} disabled={mutation.isPending}>
          {spinner('add')}
          Add
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => run('promote')}
          disabled={mutation.isPending}
        >
          {spinner('promote')}
          Promote
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => run('demote')}
          disabled={mutation.isPending}
        >
          {spinner('demote')}
          Demote
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => run('remove')}
          disabled={mutation.isPending}
        >
          {spinner('remove')}
          Remove
        </Button>
      </div>
      <ResultPanel result={mutation.data} />
    </div>
  )
}
