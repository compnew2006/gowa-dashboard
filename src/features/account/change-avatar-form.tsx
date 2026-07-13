import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { changeAvatar } from '@/api/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionMutation } from '@/hooks/use-action-mutation'

export function ChangeAvatarForm() {
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState<string>()

  const mutation = useActionMutation(changeAvatar, { successMessage: 'Avatar updated' })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (file) mutation.mutate(file)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        Upload a square image (1:1) at least 400×400 to avoid cropping.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="avatar-file">Avatar image</Label>
        <Input
          id="avatar-file"
          type="file"
          accept="image/png,image/jpg,image/jpeg"
          onChange={(event) => {
            const selected = event.target.files?.[0]
            setFile(selected)
            setPreview(selected ? URL.createObjectURL(selected) : undefined)
          }}
        />
      </div>
      {preview && (
        <img src={preview} alt="Preview" className="max-h-64 self-start rounded-md border" />
      )}
      <Button type="submit" disabled={mutation.isPending || !file} className="self-start">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Update avatar
      </Button>
    </form>
  )
}
