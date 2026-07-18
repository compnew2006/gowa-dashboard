import { useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { ChatList } from '@/features/chat/chat-list'
import { MessageView } from '@/features/chat/message-view'
import { PageHeader } from '@/components/shared/page-header'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import type { ChatInfo } from '@/api/chat'

export default function ChatsPage() {
  const device = useSelectedDevice()
  const [selected, setSelected] = useState<ChatInfo | null>(null)
  // Mobile master-detail: when true, the conversation pane is shown full-screen
  // and the list pane is hidden. Tapping a chat flips this on; the mobile back
  // bar (rendered below, md:hidden) flips it off. Desktop ignores this flag
  // (both panes are always visible at md+).
  const [mobileShowConversation, setMobileShowConversation] = useState(false)

  if (!device) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Chats" description="Stored conversations for this device." />
        <DeviceGuard />
      </div>
    )
  }

  return (
    <div className="bg-card flex h-full overflow-hidden rounded-xl border">
      <aside
        className={`${mobileShowConversation ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r md:w-80 lg:w-96`}
      >
        <ChatList
          selectedJid={selected?.jid ?? null}
          onSelect={(chat) => {
            setSelected(chat)
            setMobileShowConversation(true)
          }}
        />
      </aside>

      <section
        className={`${mobileShowConversation ? 'flex' : 'hidden md:flex'} min-h-0 flex-1 flex-col`}
      >
        {selected ? (
          <MessageView chat={selected} onBack={() => setMobileShowConversation(false)} />
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MessagesSquare className="size-8" />
            <p className="text-sm">Select a chat to view its messages</p>
          </div>
        )}
      </section>
    </div>
  )
}
