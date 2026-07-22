import { useState } from 'react'
import {
  LayoutDashboard,
  Loader2,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  PanelLeft,
  Send,
  Settings,
  UserRound,
  Users,
  Wrench,
  ShieldCheck,
  ScrollText,
  Contact,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { LanguageToggle } from '@/components/layout/language-toggle'
import { UserMenu } from '@/components/layout/user-menu'
import { WsBadge } from '@/components/layout/ws-badge'
import { DeviceSwitcher } from '@/components/layout/device-switcher'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PasskeyDialog } from '@/features/session/passkey-dialog'
import { cn } from '@/lib/utils'
import { useConnection } from '@/stores/connection'
import { useSettingsStore } from '@/stores/settings'
import { useTranslation } from '@/stores/i18n'

const navGroups = [
  {
    label: 'Overview',
    items: [{ to: '/devices', label: 'Devices', icon: LayoutDashboard }],
  },
  {
    label: 'Messaging',
    items: [
      { to: '/messaging', label: 'Messaging', icon: Send },
      { to: '/chats', label: 'Chats', icon: MessagesSquare },
    ],
  },
  {
    label: 'Directory',
    items: [
      { to: '/groups', label: 'Groups', icon: Users },
      { to: '/account', label: 'Account', icon: UserRound },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/misc', label: 'Channels & Calls', icon: Wrench },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'CRM',
    items: [
      { to: '/crm', label: 'CRM Dashboard', icon: ShieldCheck },
      { to: '/crm/contacts', label: 'Contacts', icon: Contact },
      { to: '/crm/users', label: 'Users & Roles', icon: Users },
      { to: '/crm/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
]

function NavContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { t, language } = useTranslation()
  const isRtl = language === 'ar' || language === 'ur'

  return (
    <nav className={cn('flex flex-col', collapsed ? 'gap-3' : 'gap-4')} dir={isRtl ? 'rtl' : 'ltr'}>
      {navGroups.map((group) => (
        <div key={group.label} className={cn('flex flex-col', collapsed ? 'gap-0.5' : 'gap-1')}>
          {!collapsed && (
            <p className="text-muted-foreground px-3 text-[11px] font-medium tracking-wider uppercase text-start ltr:text-left rtl:text-right">
              {t(group.label)}
            </p>
          )}
          {collapsed && group !== navGroups[0] && (
            <div className="bg-border mx-auto my-1 h-px w-6" aria-hidden />
          )}
          {group.items.map(({ to, label, icon: Icon }) => {
            const link = (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                title={collapsed ? t(label) : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors text-start ltr:text-left rtl:text-right',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && t(label)}
              </NavLink>
            )
            return collapsed ? (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{t(label)}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { t, language } = useTranslation()
  const isRtl = language === 'ar' || language === 'ur'
  const status = useConnection((state) => state.status)
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)

  if (status === 'booting') {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh" dir={isRtl ? 'rtl' : 'ltr'}>
      <aside
        dir={isRtl ? 'rtl' : 'ltr'}
        className={cn(
          'bg-sidebar text-sidebar-foreground hidden shrink-0 flex-col ltr:border-r rtl:border-l transition-[width] duration-200 ease-in-out md:flex',
          sidebarCollapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b',
            sidebarCollapsed ? 'justify-center px-0' : 'px-4',
          )}
        >
          <Logo iconOnly={sidebarCollapsed} />
        </div>
        <ScrollArea className="flex-1 px-2 py-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <NavContent collapsed={sidebarCollapsed} />
        </ScrollArea>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side={isRtl ? 'right' : 'left'} className="bg-sidebar w-72 p-0" dir={isRtl ? 'rtl' : 'ltr'}>
          <SheetHeader className="border-b">
            <SheetTitle asChild>
              <div>
                <Logo />
              </div>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-2 pb-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <NavContent onNavigate={() => setMobileNavOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              className="md:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:inline-flex"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </Button>
            <Logo className="md:hidden" />
          </div>
          <div className="ms-auto flex items-center gap-2">
            <DeviceSwitcher />
            <WsBadge />
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        {/* Non-blocking banner: the gowa connection is no longer a routing
            gate, so an authenticated-but-unconnected user can still browse;
            this slim row nudges them toward Settings to configure it. The
            booting branch already returned above, so reaching here means the
            probe resolved to a non-connected state. */}
        {status !== 'connected' && (
          <div className="bg-muted text-muted-foreground flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs text-start ltr:text-left rtl:text-right">
            <span>{t('Not connected to a gowa server')}</span>
            <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
              {t('Open Settings')}
            </Link>
          </div>
        )}
        {/* Every page is a full-bleed surface that owns the viewport below
            the top bar: `<main>` provides no padding and no centered column;
            each page renders its own single bg-card rounded surface that
            fills the height and handles its own internal padding/scroll.
            `/chats` was the first page to use this layout; it is now global.
            The `.stagger` entrance is preserved on the surface wrapper. */}
        <main className="flex-1">
          <div
            key={location.pathname}
            className="stagger h-[calc(100svh-3.5rem)] overflow-hidden p-3 md:p-4"
          >
            <Outlet />
          </div>
        </main>
      </div>
      <PasskeyDialog />
    </div>
  )
}
