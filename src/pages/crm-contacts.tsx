import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Contact,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/stores/i18n'
import { useDebounce } from '@/hooks/use-debounce'
import { useDevices } from '@/hooks/use-devices'
import {
  createContact,
  deleteContact,
  listContacts,
  syncAllDevices,
  syncFromGowa,
  updateContact,
  type CrmContact,
} from '@/api/crm/contacts'
import { isApiError } from '@/lib/api-error'

function ContactDialog({
  mode,
  contact,
  onSaved,
  children,
}: {
  mode: 'create' | 'edit'
  contact?: CrmContact
  onSaved: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [jid, setJid] = useState(contact?.jid ?? '')
  const [name, setName] = useState(contact?.name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(contact?.phoneNumber ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        await createContact({ jid, name: name || undefined, phoneNumber, email: email || undefined, notes: notes || undefined })
      } else if (contact) {
        await updateContact(contact.id, {
          name: name || undefined,
          phoneNumber,
          email: email || undefined,
          notes: notes || undefined,
        })
      }
    },
    onSuccess: () => {
      toast.success(mode === 'create' ? t('Contact created') : t('Contact updated'))
      setOpen(false)
      onSaved()
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : 'Failed to save contact'),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v && mode === 'edit' && contact) {
          setJid(contact.jid)
          setName(contact.name ?? '')
          setPhoneNumber(contact.phoneNumber)
          setEmail(contact.email ?? '')
          setNotes(contact.notes ?? '')
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('New contact') : t('Edit contact')}</DialogTitle>
          <DialogDescription>
            {t('Contacts are scoped to your workspace and can be assigned to agents.')}
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
            <Label htmlFor="c-jid">{t('WhatsApp JID')}</Label>
            <Input
              id="c-jid"
              placeholder="9665xxx@s.whatsapp.net"
              value={jid}
              onChange={(e) => setJid(e.target.value)}
              disabled={mode === 'edit'}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">{t('Name')}</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-phone">{t('Phone')}</Label>
              <Input id="c-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-email">{t('Email')}</Label>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-notes">{t('Notes')}</Label>
            <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {mode === 'create' ? t('Create') : t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CrmContactsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [syncDevice, setSyncDevice] = useState<string>('all')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  const debounced = useDebounce(search, 300)

  const contacts = useQuery({
    queryKey: ['crm', 'contacts', debounced, pageSize, page],
    queryFn: () =>
      listContacts({ search: debounced || undefined, limit: pageSize, offset: page * pageSize }),
    placeholderData: keepPreviousData,
  })

  const total = contacts.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeFrom = total === 0 ? 0 : page * pageSize + 1
  const rangeTo = Math.min((page + 1) * pageSize, total)

  // Clamp the page if the result set shrinks (e.g. after a delete or a
  // narrower search) so the user is never stranded on an empty page.
  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1)
  }, [page, totalPages])

  // gowa devices for the sync picker. useDevices returns gowa's device list
  // (the actual paired accounts: egypt, Saudi, …).
  const gowaDevices = useDevices()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['crm', 'contacts'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      toast.success(t('Contact removed'))
      invalidate()
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : 'Failed to delete'),
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (syncDevice === 'all') {
        return await syncAllDevices()
      }
      return await syncFromGowa(syncDevice)
    },
    onSuccess: (data) => {
      if ('totalUpserted' in data) {
        toast.success(
          `${t('Synced')} ${data.totalFetched} ${t('contacts from all devices')} (${data.totalUpserted} ${t('upserted')})`,
        )
      } else {
        toast.success(
          `${t('Synced')} ${data.fetched} ${t('contacts')} (${data.upserted} ${t('upserted')})`,
        )
      }
      invalidate()
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : 'Sync failed'),
  })

  return (
    <PageSurface padded>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader
          title={t('Contacts')}
          description={t('Sync from gowa devices or maintain your own CRM contacts.')}
          actions={
            <ContactDialog mode="create" onSaved={invalidate}>
              <Button variant="outline">
                <Plus className="size-4" />
                {t('New contact')}
              </Button>
            </ContactDialog>
          }
        />

        {/* Sync bar */}
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-sm">{t('Sync from gowa')}</span>
              <span className="text-muted-foreground text-xs">
                {t('Pull each device\'s WhatsApp contacts into the CRM database. Existing contacts keep their notes; name refreshes.')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={syncDevice} onValueChange={setSyncDevice}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All devices')}</SelectItem>
                  {gowaDevices.data?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t('Sync now')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={t('Search by name, phone, or JID…')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="pl-9"
          />
        </div>

        {contacts.isLoading && <Skeleton className="h-16 w-full" />}

        {contacts.error && (
          <Card>
            <CardContent className="text-destructive py-6 text-sm">
              {isApiError(contacts.error) ? contacts.error.message : 'Failed to load contacts'}
            </CardContent>
          </Card>
        )}

        {!contacts.isLoading && !contacts.error && contacts.data && contacts.data.results.length === 0 && (
          <EmptyState
            icon={Contact}
            title={t('No contacts')}
            hint={search ? t('No matches for that search.') : t('Create the first CRM contact.')}
          />
        )}

        {contacts.data && contacts.data.results.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-muted-foreground text-xs">
                {total === 0
                  ? `0 ${t('contacts')}`
                  : `${t('Showing')} ${rangeFrom}–${rangeTo} ${t('of')} ${total}`}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{t('Per page')}</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v))
                    setPage(0)
                  }}
                >
                  <SelectTrigger className="h-8 w-[4.5rem]" aria-label={t('Per page')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {contacts.data.results.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name || c.phoneNumber}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {c.jid}
                      </Badge>
                      {(c.sourceDeviceIds && c.sourceDeviceIds.length > 0
                        ? c.sourceDeviceIds
                        : c.sourceDeviceId
                          ? [c.sourceDeviceId]
                          : []
                      ).map((deviceId) => (
                        <Badge key={deviceId} variant="secondary" className="text-xs">
                          {t('from')} {deviceId}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Phone className="size-3" />
                      {c.phoneNumber}
                      {c.email && <span>· {c.email}</span>}
                    </div>
                    {c.notes && <p className="text-muted-foreground truncate text-xs">{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <ContactDialog mode="edit" contact={c} onSaved={invalidate}>
                      <Button variant="ghost" size="sm" aria-label={t('Edit')}>
                        <Pencil className="size-4" />
                      </Button>
                    </ContactDialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(c.id)}
                      aria-label={t('Delete')}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-muted-foreground text-xs">
                {t('Page')} {page + 1} {t('of')} {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || contacts.isFetching}
                >
                  <ChevronLeft className="size-4" />
                  {t('Back')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1 || contacts.isFetching}
                >
                  {t('Next')}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageSurface>
  )
}
