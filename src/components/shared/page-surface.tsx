import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Full-bleed surface every page renders into. Fills the viewport below the top
 * bar (the app-shell wrapper sets `h-[calc(100svh-3.5rem)]` + `p-3 md:p-4`),
 * shows a single `bg-card rounded-xl border` shell, and scrolls internally when
 * content overflows. This is the global version of the layout `/chats`
 * pioneered: one consistent surface per page, edge-to-edge, with the page
 * owning its own padding and scroll.
 *
 * Variant `flush` (default) drops inner padding — for pages whose children
 * manage their own padding (e.g. `/chats` master-detail, lists with sticky
 * headers). Variant `padded` adds `p-4 md:p-6` for form-heavy pages
 * (settings, account) so line lengths stay readable without a separate
 * max-width cap.
 *
 * `scroll` controls whether the body scrolls. Full-height list surfaces
 * (`/chats`) set `scroll={false}` and handle scrolling in a child; document
 * pages (`/settings`, `/account`) set `scroll` (default) so the surface scrolls
 * as a whole.
 */
export function PageSurface({
  children,
  className,
  padded = false,
  scroll = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
  scroll?: boolean
}) {
  return (
    <div className="bg-card flex h-full flex-col overflow-hidden rounded-xl border">
      <div
        className={cn(
          'flex-1 min-h-0',
          padded ? 'p-4 md:p-6' : '',
          scroll ? 'chat-scroll overflow-y-auto' : '',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
