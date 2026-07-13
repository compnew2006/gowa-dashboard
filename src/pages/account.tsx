import { ActionCard } from '@/components/shared/action-card'
import { AvatarForm } from '@/features/account/avatar-form'
import { BusinessProfileForm } from '@/features/account/business-profile-form'
import { ChangeAvatarForm } from '@/features/account/change-avatar-form'
import { ContactsView } from '@/features/account/contacts-view'
import { PrivacyView } from '@/features/account/privacy-view'
import { PushnameForm } from '@/features/account/pushname-form'
import { UserCheckForm } from '@/features/account/user-check-form'
import { UserInfoForm } from '@/features/account/user-info-form'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'

export default function AccountPage() {
  const device = useSelectedDevice()

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Profile, privacy, contacts and business info for the selected device.
        </p>
      </div>

      {!device ? (
        <DeviceGuard />
      ) : (
        <>
          <ActionCard title="User info" description="Look up a user's public info by phone or LID.">
            <UserInfoForm />
          </ActionCard>
          <ActionCard title="Avatar" description="Fetch a profile picture by phone or group.">
            <AvatarForm />
          </ActionCard>
          <ActionCard title="Change avatar" description="Update your own profile picture.">
            <ChangeAvatarForm />
          </ActionCard>
          <ActionCard title="Change push name" description="Update your WhatsApp display name.">
            <PushnameForm />
          </ActionCard>
          <ActionCard title="User check" description="Check whether a number is on WhatsApp.">
            <UserCheckForm />
          </ActionCard>
          <ActionCard
            title="Business profile"
            description="Fetch a WhatsApp Business account's public profile."
          >
            <BusinessProfileForm />
          </ActionCard>
          <ActionCard title="My privacy" description="Your current privacy settings.">
            <PrivacyView />
          </ActionCard>
          <ActionCard title="My contacts" description="Contacts synced to this device.">
            <ContactsView />
          </ActionCard>
        </>
      )}
    </div>
  )
}
