import { ActionCard } from '@/components/shared/action-card'
import { CallRejectForm } from '@/features/call/call-reject-form'
import { NewsletterList } from '@/features/newsletter/newsletter-list'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'

export default function MiscPage() {
  const device = useSelectedDevice()

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Misc</h1>
        <p className="text-sm text-muted-foreground">Newsletters and call handling.</p>
      </div>

      {!device ? (
        <DeviceGuard />
      ) : (
        <>
          <ActionCard title="Newsletters" description="Channels this device follows.">
            <NewsletterList />
          </ActionCard>
          <ActionCard
            title="Reject call"
            description="Reject an incoming call using the caller JID and call ID from the webhook."
          >
            <CallRejectForm />
          </ActionCard>
        </>
      )}
    </div>
  )
}
