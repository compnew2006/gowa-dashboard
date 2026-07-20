import { useState, useEffect } from 'react'
import { MessagesSquare } from 'lucide-react'
import { ChatList } from '@/features/chat/chat-list'
import { MessageView } from '@/features/chat/message-view'
import { PageSurface } from '@/components/shared/page-surface'
import { PageHeader } from '@/components/shared/page-header'
import { DeviceGuard, useSelectedDevice } from '@/hooks/use-device-guard'
import { useTranslation } from '@/stores/i18n'
import { cn } from '@/lib/utils'
import type { ChatInfo } from '@/api/chat'

export default function ChatsPage() {
  const { t, language } = useTranslation()
  const isRtl = language === 'ar' || language === 'ur'
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

  // Sync state from localStorage when device changes
  useEffect(() => {
    if (!selectedDeviceId) return
    const savedChat = localStorage.getItem(`gowa-ui.chats.selected-chat.${selectedDeviceId}`)
    const savedDev = localStorage.getItem(`gowa-ui.chats.selected-device.${selectedDeviceId}`)
    const savedMobileShow = localStorage.getItem(`gowa-ui.chats.selected-mobile-show.${selectedDeviceId}`)
    
    if (savedChat) {
      try {
        setSelected(JSON.parse(savedChat))
      } catch (_) {
        setSelected(null)
      }
    } else {
      setSelected(null)
    }
    setConversationDeviceId(savedDev || null)
    setMobileShowConversation(savedMobileShow === 'true')
  }, [selectedDeviceId])

  const handleSelect = (chat: ChatInfo | null, rowDeviceId: string | null) => {
    setSelected(chat)
    setConversationDeviceId(rowDeviceId ?? null)
    setMobileShowConversation(!!chat)

    if (selectedDeviceId) {
      if (chat) {
        localStorage.setItem(`gowa-ui.chats.selected-chat.${selectedDeviceId}`, JSON.stringify(chat))
        if (rowDeviceId) {
          localStorage.setItem(`gowa-ui.chats.selected-device.${selectedDeviceId}`, rowDeviceId)
        } else {
          localStorage.removeItem(`gowa-ui.chats.selected-device.${selectedDeviceId}`)
        }
        localStorage.setItem(`gowa-ui.chats.selected-mobile-show.${selectedDeviceId}`, 'true')
      } else {
        localStorage.removeItem(`gowa-ui.chats.selected-chat.${selectedDeviceId}`)
        localStorage.removeItem(`gowa-ui.chats.selected-device.${selectedDeviceId}`)
        localStorage.removeItem(`gowa-ui.chats.selected-mobile-show.${selectedDeviceId}`)
      }
    }
  }

  const handleBack = () => {
    setMobileShowConversation(false)
    if (selectedDeviceId) {
      localStorage.setItem(`gowa-ui.chats.selected-mobile-show.${selectedDeviceId}`, 'false')
    }
  }

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gowa-ui.chats-sidebar-width')
      return saved ? parseInt(saved, 10) : 320
    }
    return 320
  })
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const startResize = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault()
    setIsResizing(true)
    const startX = mouseDownEvent.clientX
    const startWidth = sidebarWidth

    const doResize = (mouseMoveEvent: MouseEvent) => {
      const dx = mouseMoveEvent.clientX - startX
      const newWidth = isRtl ? startWidth - dx : startWidth + dx
      const boundedWidth = Math.max(240, Math.min(newWidth, 600))
      setSidebarWidth(boundedWidth)
      localStorage.setItem('gowa-ui.chats-sidebar-width', boundedWidth.toString())
    }

    const stopResize = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', doResize)
      window.removeEventListener('mouseup', stopResize)
    }

    window.addEventListener('mousemove', doResize)
    window.addEventListener('mouseup', stopResize)
  }

  if (!selectedDeviceId) {
    return (
      <PageSurface padded>
        <div className="flex flex-col gap-4">
          <PageHeader title={t('Chats')} description={t('Stored conversations for this device.')} />
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
      <div 
        dir={isRtl ? 'rtl' : 'ltr'}
        className={cn('flex h-full', isResizing && 'select-none cursor-col-resize')}
      >
        <aside
          style={{
            width: isMobile ? undefined : `${sidebarWidth}px`,
          }}
          className={cn(
            mobileShowConversation ? 'hidden md:flex' : 'flex',
            'relative w-full shrink-0 flex-col ltr:border-r rtl:border-l',
          )}
        >
          <ChatList
            selectedJid={selected?.jid ?? null}
            onSelect={(chat, dId) => handleSelect(chat, dId ?? null)}
          />

          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            className="absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-50 ltr:right-0 rtl:left-0"
            title={t('Resize')}
          />
        </aside>

        <section
          className={`${mobileShowConversation ? 'flex' : 'hidden md:flex'} min-h-0 flex-1 flex-col`}
        >
          {selected ? (
            <MessageView
              chat={selected}
              deviceId={effectiveDeviceId}
              onBack={handleBack}
            />
          ) : (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <MessagesSquare className="size-8" />
              <p className="text-sm">{t('Select a chat to view its messages')}</p>
            </div>
          )}
        </section>
      </div>
    </PageSurface>
  )
}
