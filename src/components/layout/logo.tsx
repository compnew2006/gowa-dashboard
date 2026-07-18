import logoUrl from '@/assets/gowa-logo.webp'
import { cn } from '@/lib/utils'

export function Logo({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src={logoUrl} alt="gowa logo" className="size-8 shrink-0" />
      {!iconOnly && <span className="text-lg font-semibold tracking-tight">gowa</span>}
    </div>
  )
}
