import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { setGroupPhoto } from '@/api/group'
import { ResultPanel } from '@/components/shared/result-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'

export function SetPhotoForm() {
  const [groupId, setGroupId] = useState('')
  const [photo, setPhoto] = useState<File | undefined>(undefined)

  const mutation = useActionMutation(setGroupPhoto, { successMessage: 'Group photo updated' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({ group_id: groupId, photo })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="set-photo-group-id">Group ID</Label>
        <Input
          id="set-photo-group-id"
          placeholder="120363xxxxxxxxxxxx@g.us"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="set-photo-file">Photo (leave empty to remove)</Label>
        <Input
          id="set-photo-file"
          type="file"
          accept="image/*"
          onChange={(event) => setPhoto(event.target.files?.[0])}
        />
        {photo && <p className="text-xs text-muted-foreground">{photo.name}</p>}
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Update photo
      </Button>
      <ResultPanel result={mutation.data} />
    </form>
  )
}
