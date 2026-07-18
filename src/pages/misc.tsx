import { ActionCard } from '@/components/shared/action-card'
import { PageHeader } from '@/components/shared/page-header'
import { PageSurface } from '@/components/shared/page-surface'
import { CallRejectForm } from '@/features/call/call-reject-form'
import { NewsletterList } from '@/features/newsletter/newsletter-list'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'

export default function MiscPage() {
  const device = useSelectedDevice()

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title="Channels & Calls"
          description="Newsletters this device follows and call handling."
        />

        {!device ? (
          <DeviceGuard />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <ActionCard title="Newsletters" description="Channels this device follows.">
              <NewsletterList />
            </ActionCard>
            <ActionCard
              title="Reject call"
              description="Reject an incoming call using the caller JID and call ID from the webhook."
            >
              <CallRejectForm />
            </ActionCard>
          </div>
        )}
      </div>
    </PageSurface>
  )
}
