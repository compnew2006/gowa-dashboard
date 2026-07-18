import { useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { ChatList } from '@/features/chat/chat-list'
import { MessageView } from '@/features/chat/message-view'
import { PageSurface } from '@/components/shared/page-surface'
import { PageHeader } from '@/components/shared/page-header'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import type { ChatInfo } from '@/api/chat'

export default function ChatsPage() {
  const selectedDeviceId = useSelectedDevice()
  const [selected, setSelected] = useState<ChatInfo | null>(null)
  // Feature 2: the device the conversation pane is scoped to. Set to the
  // merged row's owning device id when an All-devices row is opened; null in
  // This-device mode (the conversation falls back to the global switcher's
  // device). This does NOT mutate `useDeviceStore` — the global device scope
  // must not yank every other device-scoped view when an All-devices row is
  // opened. Cleared when the conversation closes (or implicitly re-set by the
  // next All-devices row).
  const [conversationDeviceId, setConversationDeviceId] = useState<string | null>(null)
  // Mobile master-detail: when true, the conversation pane is shown full-screen
  // and the list pane is hidden. Tapping a chat flips this on; the mobile back
  // bar (rendered below, md:hidden) flips it off. Desktop ignores this flag
  // (both panes are always visible at md+).
  const [mobileShowConversation, setMobileShowConversation] = useState(false)

  if (!selectedDeviceId) {
    return (
      <PageSurface padded>
        <div className="flex flex-col gap-4">
          <PageHeader title="Chats" description="Stored conversations for this device." />
          <DeviceGuard />
        </div>
      </PageSurface>
    )
  }

  // The device the conversation reads from / writes to. Falls back to the
  // global switcher's device when no All-devices row has been opened yet (so
  // This-device mode behaves identically to pre-Feature-2).
  const effectiveDeviceId = conversationDeviceId ?? selectedDeviceId

  return (
    <PageSurface scroll={false}>
      <div className="flex h-full">
        <aside
          className={`${mobileShowConversation ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r md:w-80 lg:w-96`}
        >
          <ChatList
            selectedJid={selected?.jid ?? null}
            onSelect={(chat, rowDeviceId) => {
              setSelected(chat)
              // An All-devices row carries its owning device id; a This-device
              // row never passes one, and the conversation falls back to the
              // global switcher. Resetting on every select keeps stale scoping
              // from a prior All-devices row from leaking into a This-device row.
              setConversationDeviceId(rowDeviceId ?? null)
              setMobileShowConversation(true)
            }}
          />
        </aside>

        <section
          className={`${mobileShowConversation ? 'flex' : 'hidden md:flex'} min-h-0 flex-1 flex-col`}
        >
          {selected ? (
            <MessageView
              chat={selected}
              deviceId={effectiveDeviceId}
              onBack={() => setMobileShowConversation(false)}
            />
          ) : (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <MessagesSquare className="size-8" />
              <p className="text-sm">Select a chat to view its messages</p>
            </div>
          )}
        </section>
      </div>
    </PageSurface>
  )
}
