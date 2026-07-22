import { useNavigate } from 'react-router-dom'
import { LogOut, UserRound } from 'lucide-react'
import { logout as crmLogout } from '@/api/crm/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'
import { useConnection } from '@/stores/connection'
import { useTranslation } from '@/stores/i18n'

/**
 * Top-bar user menu. Shows the signed-in CRM user (full name, falling back to
 * email) as a chip; the gowa baseUrl is kept as a secondary muted line for
 * operator context. The single Log out action ends the unified JWT session:
 * best-effort CRM logout, clear the auth store, and return to /login. The gowa
 * connection config is intentionally preserved so the next login restores the
 * server/username without re-entry.
 */
export function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const baseUrl = useConnection((state) => state.baseUrl)

  const label = user?.fullName ?? user?.email ?? t('Not signed in')

  const onLogout = () => {
    // Best-effort CRM logout is fire-and-forget: it inherits a 30s axios
    // timeout and self-swallows errors (see src/api/crm/auth.ts). The
    // security-critical local teardown below must run immediately, without
    // waiting on the network. `crmLogout` already catches internally; the
    // trailing `.catch` is belt-and-suspenders against a floating promise.
    crmLogout().catch(() => {})
    useAuthStore.getState().logout()
    navigate('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <UserRound className="size-4" />
          <span className="max-w-[10rem] truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{label}</span>
          {baseUrl && (
            <span className="text-muted-foreground truncate font-mono text-xs font-normal">
              {baseUrl}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOut className="size-4" />
          {t('Log out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
