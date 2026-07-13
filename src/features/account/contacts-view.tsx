import { useQuery } from '@tanstack/react-query'
import { listContacts } from '@/api/user'
import { Skeleton } from '@/components/ui/skeleton'
import { useSelectedDevice } from '@/hooks/use-device-guard'
import { toApiError } from '@/lib/api-error'

export function ContactsView() {
  const device = useSelectedDevice()
  const { data, isLoading, error } = useQuery({
    queryKey: ['contacts', device],
    queryFn: listContacts,
    enabled: !!device,
  })

  if (isLoading) return <Skeleton className="h-32" />
  if (error) return <p className="text-sm text-destructive">{toApiError(error).message}</p>

  const contacts = data?.data ?? []
  if (contacts.length === 0)
    return <p className="text-sm text-muted-foreground">No contacts synced.</p>

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{contacts.length} contacts</p>
      <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
        {contacts.map((contact) => (
          <li key={contact.jid} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
            <span className="truncate">{contact.name || '—'}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {contact.jid.split('@')[0]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
