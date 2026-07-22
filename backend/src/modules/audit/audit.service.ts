import { Injectable, Inject } from '@nestjs/common'
import { eq, and, desc, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { auditLogs } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'

@Injectable()
export class AuditService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
  ) {}

  /**
   * Paginated audit log for a workspace. Filters: userId, action prefix,
   * target type, date window.
   */
  async list(
    workspaceId: string,
    opts: {
      userId?: string
      action?: string
      targetType?: string
      since?: string
      until?: string
      limit?: number
      offset?: number
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? 100, 500)
    const offset = Math.max(opts.offset ?? 0, 0)
    const conds = [eq(auditLogs.workspaceId, workspaceId)]
    if (opts.userId) conds.push(eq(auditLogs.userId, opts.userId))
    if (opts.targetType) conds.push(eq(auditLogs.targetType, opts.targetType))
    if (opts.action) conds.push(sql`${auditLogs.action} like ${opts.action + '%'}`)

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(and(...conds))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset)
    return rows
  }

  async count(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(eq(auditLogs.workspaceId, workspaceId))
    return row?.count ?? 0
  }

  /**
   * Direct insert — used by AuthService (login/logout) and the proxy to record
   * events that aren't driven by a DB trigger (e.g. successful auth, gowa
   * send/reaction). Bypasses RLS by setting the workspace context first.
   */
  async record(opts: {
    workspaceId: string
    userId?: string | null
    action: string
    targetType: string
    targetId?: string
    payload?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      workspaceId: opts.workspaceId,
      userId: opts.userId ?? null,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId ?? null,
      payload: opts.payload ?? null,
      ipAddress: opts.ipAddress ?? '0.0.0.0',
      userAgent: opts.userAgent ?? null,
    })
  }
}
