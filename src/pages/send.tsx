import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import { SendTextForm } from '@/features/send/text-form'
import { SendImageForm } from '@/features/send/image-form'
import { SendFileForm } from '@/features/send/file-form'
import { SendVideoForm } from '@/features/send/video-form'
import { SendStickerForm } from '@/features/send/sticker-form'
import { SendAudioForm } from '@/features/send/audio-form'
import { SendContactForm } from '@/features/send/contact-form'
import { SendLocationForm } from '@/features/send/location-form'
import { SendLinkForm } from '@/features/send/link-form'
import { SendPollForm } from '@/features/send/poll-form'
import { SendPresenceForm } from '@/features/send/presence-form'
import { SendChatPresenceForm } from '@/features/send/chat-presence-form'

const tabs = [
  { value: 'text', label: 'Text', form: <SendTextForm /> },
  { value: 'image', label: 'Image', form: <SendImageForm /> },
  { value: 'file', label: 'File', form: <SendFileForm /> },
  { value: 'video', label: 'Video', form: <SendVideoForm /> },
  { value: 'sticker', label: 'Sticker', form: <SendStickerForm /> },
  { value: 'audio', label: 'Audio', form: <SendAudioForm /> },
  { value: 'contact', label: 'Contact', form: <SendContactForm /> },
  { value: 'location', label: 'Location', form: <SendLocationForm /> },
  { value: 'link', label: 'Link', form: <SendLinkForm /> },
  { value: 'poll', label: 'Poll', form: <SendPollForm /> },
  { value: 'presence', label: 'Presence', form: <SendPresenceForm /> },
  { value: 'chat-presence', label: 'Chat presence', form: <SendChatPresenceForm /> },
]

export default function SendPage() {
  const device = useSelectedDevice()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Send</h1>
        <p className="text-sm text-muted-foreground">
          Send messages, media, and presence to a WhatsApp chat
        </p>
      </div>

      {device === null ? (
        <DeviceGuard />
      ) : (
        <Tabs defaultValue="text">
          <TabsList className="h-auto w-full flex-wrap group-data-horizontal/tabs:h-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <Card>
                <CardContent>{tab.form}</CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
