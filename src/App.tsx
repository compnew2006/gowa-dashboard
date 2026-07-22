import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth } from '@/components/auth/require-auth'
import { onWsEvent } from '@/lib/events'
import { wsClient } from '@/lib/ws'
import { useConnection } from '@/stores/connection'
import { useDeviceStore } from '@/stores/device'
import { useI18nStore } from '@/stores/i18n'
import AccountPage from '@/pages/account'
import ChatsPage from '@/pages/chats'
import DashboardPage from '@/pages/dashboard'
import GroupsPage from '@/pages/groups'
import LoginPage from '@/pages/login'
import MessagingPage from '@/pages/messaging'
import MiscPage from '@/pages/misc'
import SettingsPage from '@/pages/settings'
import CrmDashboardPage from '@/pages/crm-dashboard'
import CrmUsersPage from '@/pages/crm-users'
import CrmContactsPage from '@/pages/crm-contacts'
import CrmAuditPage from '@/pages/crm-audit'

function useBootstrap() {
  const queryClient = useQueryClient()

  useEffect(() => {
    void useConnection.getState().boot()
    // Bootstrap language and document direction
    const currentLang = useI18nStore.getState().language
    useI18nStore.getState().setLanguage(currentLang)
  }, [])

  useEffect(() => {
    wsClient.sync()
    const unsubscribeConnection = useConnection.subscribe(() => wsClient.sync())
    const unsubscribeDevice = useDeviceStore.subscribe(() => wsClient.sync())
    return () => {
      unsubscribeConnection()
      unsubscribeDevice()
      wsClient.stop()
    }
  }, [])

  useEffect(
    () =>
      onWsEvent((event) => {
        switch (event.code) {
          case 'LOGIN_SUCCESS':
          case 'LIST_DEVICES':
          case 'DEVICE_LOGGED_OUT':
            void queryClient.invalidateQueries({ queryKey: ['devices'] })
            break
          case 'DEVICE_REMOVED': {
            void queryClient.invalidateQueries({ queryKey: ['devices'] })
            const removed = (event.result as { device_id?: string } | null)?.device_id
            const { selectedDeviceId, selectDevice } = useDeviceStore.getState()
            if (removed && removed === selectedDeviceId) selectDevice(null)
            break
          }
          case 'message.event':
            // Backend signal that a message or reaction landed (Half 1 of the
            // reactions-visibility fix). Invalidating both query families makes
            // the new pill / quote bubble appear within ~1s instead of waiting
            // for the 5s refetchInterval poll.
            void queryClient.invalidateQueries({ queryKey: ['chats'] })
            void queryClient.invalidateQueries({ queryKey: ['chat-messages'] })
            break
          default:
            // For any other events (such as message, reaction, receipt, chat, etc.),
            // invalidate chats and chat messages to keep the UI perfectly synchronized in real-time.
            void queryClient.invalidateQueries({ queryKey: ['chats'] })
            void queryClient.invalidateQueries({ queryKey: ['chat-messages'] })
            break
        }
      }),
    [queryClient],
  )
}

function App() {
  useBootstrap()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/chats" replace />} />
          <Route path="/devices" element={<DashboardPage />} />
          <Route path="/messaging" element={<MessagingPage />} />
          <Route path="/send" element={<Navigate to="/messaging" replace />} />
          <Route path="/messages" element={<Navigate to="/messaging" replace />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/misc" element={<MiscPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* CRM routes — now plain children; the outer RequireAuth gates the
              whole app, so no inner wrapper is needed. */}
          <Route path="/crm" element={<CrmDashboardPage />} />
          <Route path="/crm/users" element={<CrmUsersPage />} />
          <Route path="/crm/contacts" element={<CrmContactsPage />} />
          <Route path="/crm/audit" element={<CrmAuditPage />} />
          {/* Backward-compat: stale /connect bookmarks redirect to Settings.
              Lives inside the gated group so anonymous /connect hits are
              caught by the outer RequireAuth and sent to /login, not bounced
              through /settings. */}
          <Route path="/connect" element={<Navigate to="/settings" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
