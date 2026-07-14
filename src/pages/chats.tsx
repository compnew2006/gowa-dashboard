import { useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { ChatList } from '@/features/chat/chat-list'
import { MessageView } from '@/features/chat/message-view'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import type { ChatInfo } from '@/api/chat'

export default function ChatsPage() {
  const device = useSelectedDevice()
  const [selected, setSelected] = useState<ChatInfo | null>(null)

  if (!device) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Chats" description="Stored conversations for this device." />
        <DeviceGuard />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-8.5rem)] flex-col gap-4">
      <PageHeader title="Chats" description="Stored conversations for this device." />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="min-h-0 overflow-hidden p-3">
          <ChatList selectedJid={selected?.jid ?? null} onSelect={setSelected} />
        </Card>
        <Card className="min-h-0 overflow-hidden p-3">
          {selected ? (
            <MessageView chat={selected} />
          ) : (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2">
              <MessagesSquare className="size-8" />
              <p className="text-sm">Select a chat to view its messages</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
