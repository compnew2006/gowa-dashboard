import { useQuery } from '@tanstack/react-query'
import { Activity, Inbox, Send, MessagesSquare, ScrollText, Users } from 'lucide-react'
import { PageSurface } from '@/components/shared/page-surface'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/stores/i18n'
import { getMessageStats } from '@/api/crm/messages'
import { listAudit } from '@/api/crm/audit'
import { listUsers } from '@/api/crm/users'

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string | null
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value ?? '—'}</div>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function CrmDashboardPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  const stats = useQuery({ queryKey: ['crm', 'message-stats'], queryFn: getMessageStats })
  const audit = useQuery({
    queryKey: ['crm', 'audit', 'dashboard'],
    queryFn: () => listAudit({ limit: 5 }),
  })
  const users = useQuery({ queryKey: ['crm', 'users', 'dashboard'], queryFn: listUsers })

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title={t('CRM Dashboard')}
          description={
            user
              ? `${t('Signed in as')} ${user.email}${user.roleName ? ` (${user.roleName})` : ''}`
              : t('Workspace overview')
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={Users}
            label={t('Users')}
            value={users.isLoading ? null : users.data?.length ?? 0}
            hint={t('workspace members')}
          />
          <StatCard
            icon={MessagesSquare}
            label={t('Messages')}
            value={stats.isLoading ? null : stats.data?.total ?? 0}
            hint={t('persisted in ledger')}
          />
          <StatCard
            icon={Inbox}
            label={t('Inbound')}
            value={stats.isLoading ? null : stats.data?.inbound ?? 0}
          />
          <StatCard
            icon={Send}
            label={t('Outbound')}
            value={stats.isLoading ? null : stats.data?.outbound ?? 0}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              {t('Recent activity')}
            </CardTitle>
            <CardDescription>{t('Last audit-log entries across the workspace')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {audit.isLoading && <Skeleton className="h-16 w-full" />}
            {!audit.isLoading && audit.data && audit.data.results.length === 0 && (
              <p className="text-muted-foreground text-sm">{t('No audit entries yet.')}</p>
            )}
            {audit.data?.results.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b pb-2 last:border-none last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{entry.action}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {entry.targetType}
                    {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ''}
                  </span>
                </div>
                <div className="text-muted-foreground text-end text-xs whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                  <div>{entry.ipAddress}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4" />
              {t('Quick links')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {t('Manage workspace users, browse the audit log, or maintain CRM contacts from the sidebar.')}
          </CardContent>
        </Card>
      </div>
    </PageSurface>
  )
}
