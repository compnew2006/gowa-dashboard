import { useState, useEffect, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/stores/i18n'

export function DeviceAliasForm({ deviceId }: { deviceId: string }) {
  const { t } = useTranslation()
  const [alias, setAlias] = useState('')

  useEffect(() => {
    if (deviceId) {
      setAlias(localStorage.getItem(`gowa-ui.device-alias.${deviceId}`) || '')
    }
  }, [deviceId])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!deviceId) return

    if (alias.trim()) {
      localStorage.setItem(`gowa-ui.device-alias.${deviceId}`, alias.trim())
    } else {
      localStorage.removeItem(`gowa-ui.device-alias.${deviceId}`)
    }

    // Trigger local update across active components
    window.dispatchEvent(new Event('device-alias-updated'))
    toast.success(t('Device tag name updated successfully'))
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="device-alias">{t('Custom Tag Name')}</Label>
        <Input
          id="device-alias"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          placeholder={t('e.g. Sales Team, Support, My Phone')}
        />
        <p className="text-muted-foreground text-xs">
          {t('This name will be displayed on the tag next to chats in the merged/all-devices view.')}
        </p>
      </div>
      <Button type="submit" className="self-start">
        {t('Save Tag Name')}
      </Button>
    </form>
  )
}

