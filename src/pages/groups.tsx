import { ActionCard } from '@/components/shared/action-card'
import { CreateGroupForm } from '@/features/group/create-group-form'
import { GroupList } from '@/features/group/group-list'
import { InfoForm } from '@/features/group/info-form'
import { InfoFromLinkForm } from '@/features/group/info-from-link-form'
import { InviteLinkForm } from '@/features/group/invite-link-form'
import { JoinWithLinkForm } from '@/features/group/join-with-link-form'
import { ParticipantRequests } from '@/features/group/participant-requests'
import { ParticipantsForm } from '@/features/group/participants-form'
import { SetAnnounceForm } from '@/features/group/set-announce-form'
import { SetLockedForm } from '@/features/group/set-locked-form'
import { SetNameForm } from '@/features/group/set-name-form'
import { SetPhotoForm } from '@/features/group/set-photo-form'
import { SetTopicForm } from '@/features/group/set-topic-form'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'

export default function GroupsPage() {
  const deviceId = useSelectedDevice()
  if (!deviceId) return <DeviceGuard />

  return (
    <div className="flex flex-col gap-6">
      <GroupList />

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionCard title="Create group" description="Start a new group with participants.">
          <CreateGroupForm />
        </ActionCard>
        <ActionCard title="Join with link" description="Join a group from its invite link.">
          <JoinWithLinkForm />
        </ActionCard>
        <ActionCard title="Group info" description="Fetch metadata for a group you belong to.">
          <InfoForm />
        </ActionCard>
        <ActionCard title="Group info from link" description="Preview a group before joining.">
          <InfoFromLinkForm />
        </ActionCard>
        <ActionCard title="Invite link" description="Get or reset the group's invite link.">
          <InviteLinkForm />
        </ActionCard>
        <ActionCard
          title="Manage participants"
          description="Add, remove, promote, or demote members."
        >
          <ParticipantsForm />
        </ActionCard>
        <ActionCard title="Participant requests" description="Approve or reject join requests.">
          <ParticipantRequests />
        </ActionCard>
        <ActionCard title="Group name" description="Rename the group.">
          <SetNameForm />
        </ActionCard>
        <ActionCard title="Group topic" description="Update or clear the group description.">
          <SetTopicForm />
        </ActionCard>
        <ActionCard title="Group photo" description="Set or remove the group photo.">
          <SetPhotoForm />
        </ActionCard>
        <ActionCard title="Announce mode" description="Restrict messaging to admins.">
          <SetAnnounceForm />
        </ActionCard>
        <ActionCard title="Locked" description="Restrict editing group info to admins.">
          <SetLockedForm />
        </ActionCard>
      </div>
    </div>
  )
}
