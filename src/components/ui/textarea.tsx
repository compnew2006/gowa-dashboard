import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-primary/30 hover:border-primary/60 focus-visible:border-primary bg-primary/[0.03] focus-visible:bg-background placeholder:text-muted-foreground focus-visible:ring-primary/40 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:border-primary/40 dark:bg-primary/[0.08] dark:hover:border-primary/60 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-16 w-full rounded-lg border px-2.5 py-2 text-base transition-all outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
