import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PageSurface } from '@/components/shared/page-surface'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/stores/i18n'
import {
  assignRole,
  createUser,
  deleteUser,
  KNOWN_ROLES,
  listUsers,
  type CrmUserRow,
} from '@/api/crm/users'
import { isApiError } from '@/lib/api-error'

function roleBadgeColor(roleName?: string | null): string {
  switch (roleName) {
    case 'SuperAdmin':
      return 'bg-red-500/15 text-red-600 dark:text-red-400'
    case 'Admin':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
    case 'Manager':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
    case 'Agent':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function UserCard({
  user,
  canDelete,
  canManage,
  onRoleChange,
  onDelete,
}: {
  user: CrmUserRow
  canDelete: boolean
  canManage: boolean
  onRoleChange: (id: string, role: string) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{user.fullName || user.email}</span>
            <span className="text-muted-foreground text-sm">{user.email}</span>
          </div>
          <Badge className={roleBadgeColor(user.role?.name)} variant="secondary">
            {user.role?.name ?? 'unknown'}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {user.isActive ? t('Active') : t('Disabled')} · {new Date(user.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            {canManage && (
              <Select value={user.role?.name} onValueChange={(role) => onRoleChange(user.id, role)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder={t('Role')} />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_ROLES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(user.id)}
                disabled={!canDelete}
                aria-label={t('Delete user')}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => createUser({ email, password, fullName: fullName || undefined, roleId: undefined }),
    onSuccess: () => {
      toast.success(t('User created'))
      setOpen(false)
      setEmail('')
      setFullName('')
      setPassword('')
      onCreated()
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : 'Failed to create user'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          {t('New user')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Create user')}</DialogTitle>
          <DialogDescription>
            {t('New users get the Agent role by default; promote them after creation.')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">{t('Email')}</Label>
            <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">{t('Full name')}</Label>
            <Input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">{t('Password')}</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CrmUsersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.user)

  const users = useQuery({ queryKey: ['crm', 'users'], queryFn: listUsers })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['crm', 'users'] })
  }

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => assignRole(id, role),
    onSuccess: () => {
      toast.success(t('Role updated'))
      invalidate()
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : 'Failed to update role'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      toast.success(t('User removed'))
      invalidate()
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : 'Failed to delete user'),
  })

  const canManage = me?.roleName === 'SuperAdmin' || me?.roleName === 'Admin'

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title={t('Users & Roles')}
          description={t('Manage workspace members and their permissions.')}
          actions={canManage ? <CreateUserDialog onCreated={invalidate} /> : undefined}
        />

        {users.isLoading && <Skeleton className="h-24 w-full" />}

        {!users.isLoading && !users.error && users.data && users.data.length === 0 && (
          <EmptyState icon={ShieldCheck} title={t('No users')} hint={t('Create the first workspace member.')} />
        )}

        {users.error && (
          <Card>
            <CardContent className="text-destructive py-6 text-sm">
              {isApiError(users.error) ? users.error.message : 'Failed to load users'}
            </CardContent>
          </Card>
        )}

        {users.data && users.data.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {users.data.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                canDelete={canManage && u.id !== me?.id}
                canManage={canManage}
                onRoleChange={(id, role) => roleMutation.mutate({ id, role })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </PageSurface>
  )
}
