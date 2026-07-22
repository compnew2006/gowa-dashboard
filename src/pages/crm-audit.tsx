import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText, Search } from 'lucide-react'
import { PageSurface } from '@/components/shared/page-surface'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/stores/i18n'
import { useDebounce } from '@/hooks/use-debounce'
import { listAudit, type AuditEntry } from '@/api/crm/audit'
import { isApiError } from '@/lib/api-error'

const ACTION_PREFIXES = [
  { value: '', label: 'all' },
  { value: 'auth', label: 'auth.*' },
  { value: 'proxy', label: 'proxy.*' },
  { value: 'contact', label: 'contact.*' },
  { value: 'device', label: 'device.*' },
  { value: 'message', label: 'message.*' },
  { value: 'workspace_member', label: 'workspace_member.*' },
  { value: 'campaign', label: 'campaign.*' },
]

function actionColor(action: string): string {
  if (action.startsWith('auth')) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (action.startsWith('proxy')) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
  if (action.startsWith('contact')) return 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
  if (action.startsWith('device')) return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
  if (action.startsWith('message')) return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
  if (action.startsWith('workspace_member')) return 'bg-pink-500/15 text-pink-600 dark:text-pink-400'
  return 'bg-muted text-muted-foreground'
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  let payloadSummary = ''
  if (entry.payload) {
    try {
      const p = entry.payload as { path?: string; method?: string; op?: string; email?: string }
      const bits: string[] = []
      if (p.op) bits.push(String(p.op))
      if (p.method) bits.push(String(p.method))
      if (p.path) bits.push(String(p.path))
      if (p.email) bits.push(`email=${String(p.email)}`)
      payloadSummary = bits.join(' · ')
    } catch {
      // ignore
    }
  }

  return (
    <div className="hover:bg-accent/30 flex flex-col gap-1 border-b px-3 py-2 last:border-none sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`text-xs ${actionColor(entry.action)}`}>
            {entry.action}
          </Badge>
          <span className="text-muted-foreground font-mono text-xs">{entry.targetType}</span>
        </div>
        {payloadSummary && (
          <p className="text-muted-foreground truncate font-mono text-xs">{payloadSummary}</p>
        )}
      </div>
      <div className="text-muted-foreground flex flex-col gap-0.5 text-xs whitespace-nowrap sm:text-end">
        <span>{new Date(entry.createdAt).toLocaleString()}</span>
        <span className="font-mono text-[10px]">
          {entry.ipAddress}
          {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ''}
        </span>
      </div>
    </div>
  )
}

export default function CrmAuditPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [prefix, setPrefix] = useState('')
  const debounced = useDebounce(search, 300)

  // If the user types a custom search, use it as the action filter; else use the dropdown.
  const actionFilter = debounced || prefix

  const audit = useQuery({
    queryKey: ['crm', 'audit', actionFilter],
    queryFn: () => listAudit({ action: actionFilter || undefined, limit: 100 }),
  })

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title={t('Audit Log')}
          description={t('Every meaningful mutation in the workspace, newest first.')}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder={t('Filter by action prefix (e.g. contact, auth.login, proxy.post)…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={prefix}
            onValueChange={(v) => {
              setPrefix(v)
              setSearch('')
            }}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder={t('Quick filter')} />
            </SelectTrigger>
            <SelectContent>
              {ACTION_PREFIXES.map((p) => (
                <SelectItem key={p.value || 'all'} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {audit.isLoading && <Skeleton className="h-64 w-full" />}

        {audit.error && (
          <Card>
            <CardContent className="text-destructive py-6 text-sm">
              {isApiError(audit.error) ? audit.error.message : 'Failed to load audit log'}
            </CardContent>
          </Card>
        )}

        {!audit.isLoading && !audit.error && audit.data && audit.data.results.length === 0 && (
          <EmptyState icon={ScrollText} title={t('No audit entries')} hint={t('Nothing matches the current filter.')} />
        )}

        {audit.data && audit.data.results.length > 0 && (
          <Card>
            <CardContent className="flex flex-col p-0">
              <div className="text-muted-foreground border-b px-3 py-2 text-xs">
                {audit.data.results.length} {t('of')} {audit.data.total} {t('entries')}
              </div>
              {audit.data.results.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageSurface>
  )
}
