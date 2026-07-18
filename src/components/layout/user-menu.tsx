import { LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useConnection } from '@/stores/connection'

/**
 * Top-bar user menu. Shows the basic-auth username as a chip; the dropdown
 * offers a single Log out action that clears the stored connection (URL +
 * credentials) and returns the user to /connect via the connection gate.
 */
export function UserMenu() {
  const username = useConnection((state) => state.username)
  const baseUrl = useConnection((state) => state.baseUrl)
  const disconnect = useConnection((state) => state.disconnect)

  const label = username || 'Not signed in'

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
        <DropdownMenuItem variant="destructive" onClick={() => disconnect()}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
