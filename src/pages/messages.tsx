import { ActionCard } from '@/components/shared/action-card'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import {
  DeleteForm,
  ForwardForm,
  ReactForm,
  ReadForm,
  RevokeForm,
  StarForm,
  UpdateForm,
} from '@/features/message/message-forms'

export default function MessagesPage() {
  const device = useSelectedDevice()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Message actions</h1>
        <p className="text-sm text-muted-foreground">
          Act on a sent or received message by its ID and chat recipient.
        </p>
      </div>
      {!device ? (
        <DeviceGuard />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ActionCard title="React" description="Add or remove an emoji reaction">
            <ReactForm />
          </ActionCard>
          <ActionCard title="Update" description="Edit the text of a sent message">
            <UpdateForm />
          </ActionCard>
          <ActionCard title="Mark as read">
            <ReadForm />
          </ActionCard>
          <ActionCard title="Star / Unstar">
            <StarForm />
          </ActionCard>
          <ActionCard title="Revoke" description="Delete for everyone (sender only)">
            <RevokeForm />
          </ActionCard>
          <ActionCard title="Delete" description="Delete for me">
            <DeleteForm />
          </ActionCard>
          <ActionCard title="Forward" description="Forward a message to a chat">
            <ForwardForm />
          </ActionCard>
        </div>
      )}
    </div>
  )
}
