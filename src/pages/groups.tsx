import { useState } from 'react'
import { Eye, Link, Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PageSurface } from '@/components/shared/page-surface'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import { CreateGroupForm } from '@/features/group/create-group-form'
import { GroupDetailSheet } from '@/features/group/group-detail-sheet'
import { GroupDirectory } from '@/features/group/group-list'
import { InfoFromLinkForm } from '@/features/group/info-from-link-form'
import { JoinWithLinkForm } from '@/features/group/join-with-link-form'
import type { MyGroup } from '@/api/group'
import { useTranslation } from '@/stores/i18n'

function HeaderDialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export default function GroupsPage() {
  const { t } = useTranslation()
  const deviceId = useSelectedDevice()
  const [selected, setSelected] = useState<MyGroup | null>(null)

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title={t('Groups')}
          description={t('Groups this device belongs to — select one to manage it.')}
          actions={
            <>
              <HeaderDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Eye className="size-4" />
                    {t('Preview link')}
                  </Button>
                }
                title={t('Group info from link')}
                description={t('Preview a group before joining.')}
              >
                <InfoFromLinkForm />
              </HeaderDialog>
              <HeaderDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Link className="size-4" />
                    {t('Join with link')}
                  </Button>
                }
                title={t('Join with link')}
                description={t('Join a group from its invite link.')}
              >
                <JoinWithLinkForm />
              </HeaderDialog>
              <HeaderDialog
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" />
                    {t('Create group')}
                  </Button>
                }
                title={t('Create group')}
                description={t('Start a new group with participants.')}
              >
                <CreateGroupForm />
              </HeaderDialog>
            </>
          }
        />
        {!deviceId ? (
          <DeviceGuard />
        ) : (
          <>
            <GroupDirectory onSelect={setSelected} />
            <GroupDetailSheet group={selected} onOpenChange={(open) => !open && setSelected(null)} />
          </>
        )}
      </div>
    </PageSurface>
  )
}
