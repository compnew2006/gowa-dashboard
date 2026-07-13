import { CheckCircle2 } from 'lucide-react'

export function ResultPanel({ result }: { result: unknown }) {
  if (result === undefined || result === null) return null
  return (
    <div className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-4" />
        Success
      </div>
      <pre className="overflow-x-auto text-xs text-muted-foreground">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}
