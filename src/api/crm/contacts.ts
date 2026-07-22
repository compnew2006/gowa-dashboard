import { api, unwrap } from '@/lib/api'

export interface CrmContact {
  id: string
  jid: string
  name: string | null
  phoneNumber: string
  email: string | null
  notes: string | null
  assignedUserId: string | null
  sourceDeviceId: string | null
  createdAt: string
  updatedAt: string
}

export interface ListContactsOpts {
  search?: string
  limit?: number
  offset?: number
}

export interface ContactsListResponse {
  results: CrmContact[]
  total: number
}

export async function listContacts(opts: ListContactsOpts = {}): Promise<ContactsListResponse> {
  const res = await api.get<{ code: string; message: string; results: CrmContact[]; total: number }>('/contacts', {
    params: {
      search: opts.search || undefined,
      limit: opts.limit,
      offset: opts.offset,
    },
  })
  return { results: res.data.results, total: res.data.total ?? res.data.results.length }
}

export interface CreateContactPayload {
  jid: string
  name?: string
  phoneNumber: string
  email?: string
  notes?: string
}

export async function createContact(payload: CreateContactPayload): Promise<CrmContact> {
  return unwrap<CrmContact>(api.post('/contacts', payload))
}

export interface UpdateContactPayload {
  name?: string
  phoneNumber?: string
  email?: string
  notes?: string
}

export async function updateContact(id: string, payload: UpdateContactPayload): Promise<CrmContact> {
  return unwrap<CrmContact>(api.patch(`/contacts/${id}`, payload))
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`/contacts/${id}`)
}

// ----- Sync from gowa -----

export interface SyncSingleResult {
  fetched: number
  upserted: number
  skipped: number
}

export interface SyncAllResult {
  devices: Array<{ deviceId: string; status: string; stats?: SyncSingleResult; error?: string }>
  totalFetched: number
  totalUpserted: number
}

export async function syncFromGowa(deviceId: string): Promise<SyncSingleResult> {
  return unwrap<SyncSingleResult>(api.post('/contacts/sync-from-gowa', { deviceId }))
}

export async function syncAllDevices(): Promise<SyncAllResult> {
  return unwrap<SyncAllResult>(api.post('/contacts/sync-all-devices', {}))
}
