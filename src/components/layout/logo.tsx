import { cn } from '@/lib/utils'

export function Logo({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-8 shrink-0"
      >
        {/* Ambient background ring */}
        <circle cx="16" cy="16" r="14" className="fill-emerald-500/10 dark:fill-emerald-500/15" />
        
        {/* Clever G-shaped Chat bubble enclosing a double checkmark (representing Go + WhatsApp + Multi-device) */}
        <path
          d="M16 4C9.373 4 4 9.373 4 16C4 18.257 4.628 20.364 5.719 22.172L4 28L9.828 26.281C11.636 27.372 13.743 28 16 28C22.627 28 28 22.627 28 16C28 9.373 22.627 4 16 4Z"
          stroke="url(#logo-grad-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Multi-device nodes representing connectivity */}
        <circle cx="11" cy="12" r="1.5" className="fill-emerald-500" />
        <circle cx="21" cy="12" r="1.5" className="fill-emerald-500" />
        
        {/* Double-check forming a modern connection wave */}
        <path
          d="M10 17.5L14 21.5L22 12.5"
          stroke="url(#logo-grad-check)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 17.5L16.5 20L22 14"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <defs>
          <linearGradient id="logo-grad-primary" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#059669" /> {/* Emerald-600 */}
            <stop offset="1" stopColor="#3b82f6" /> {/* Blue-500 */}
          </linearGradient>
          <linearGradient id="logo-grad-check" x1="10" y1="12.5" x2="22" y2="21.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      {!iconOnly && (
        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-blue-500 bg-clip-text text-transparent">
          gowa
        </span>
      )}
    </div>
  )
}

