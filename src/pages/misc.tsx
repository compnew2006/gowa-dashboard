import { ActionCard } from '@/components/shared/action-card'
import { PageHeader } from '@/components/shared/page-header'
import { PageSurface } from '@/components/shared/page-surface'
import { CallRejectForm } from '@/features/call/call-reject-form'
import { NewsletterList } from '@/features/newsletter/newsletter-list'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import { useTranslation } from '@/stores/i18n'

export default function MiscPage() {
  const { t } = useTranslation()
  const device = useSelectedDevice()

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title={t('Channels & Calls')}
          description={t('Newsletters this device follows and call handling.')}
        />

        {!device ? (
          <DeviceGuard />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <ActionCard title={t('Newsletters')} description={t('Channels this device follows.')}>
              <NewsletterList />
            </ActionCard>
            <ActionCard
              title={t('Reject call')}
              description={t('Reject an incoming call using the caller JID and call ID from the webhook.')}
            >
              <CallRejectForm />
            </ActionCard>
          </div>
        )}
      </div>
    </PageSurface>
  )
}
