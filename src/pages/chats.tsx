import { useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { ChatList } from '@/features/chat/chat-list'
import { MessageView } from '@/features/chat/message-view'
import { Card } from '@/components/ui/card'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import type { ChatInfo } from '@/api/chat'

export default function ChatsPage() {
  const device = useSelectedDevice()
  const [selected, setSelected] = useState<ChatInfo | null>(null)

  if (!device) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Chats</h1>
        <DeviceGuard />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-7rem)] flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Chats</h1>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="min-h-0 overflow-hidden p-3">
          <ChatList selectedJid={selected?.jid ?? null} onSelect={setSelected} />
        </Card>
        <Card className="min-h-0 overflow-hidden p-3">
          {selected ? (
            <MessageView chat={selected} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessagesSquare className="size-8" />
              <p className="text-sm">Select a chat to view its messages</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
