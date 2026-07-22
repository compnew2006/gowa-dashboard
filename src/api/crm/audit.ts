import { api } from '@/lib/api'

export interface AuditEntry {
  id: string
  workspaceId: string
  userId: string | null
  action: string
  targetType: string
  targetId: string | null
  payload: Record<string, unknown> | null
  ipAddress: string
  userAgent: string | null
  createdAt: string
}

export interface ListAuditOpts {
  userId?: string
  action?: string // prefix match on the backend
  targetType?: string
  since?: string
  until?: string
  limit?: number
  offset?: number
}

export interface AuditListResponse {
  results: AuditEntry[]
  total: number
}

export async function listAudit(opts: ListAuditOpts = {}): Promise<AuditListResponse> {
  const res = await api.get<{ code: string; message: string; results: AuditEntry[]; total: number }>('/audit', {
    params: {
      userId: opts.userId || undefined,
      action: opts.action || undefined,
      targetType: opts.targetType || undefined,
      since: opts.since || undefined,
      until: opts.until || undefined,
      limit: opts.limit,
      offset: opts.offset,
    },
  })
  return { results: res.data.results, total: res.data.total ?? res.data.results.length }
}
