import { Injectable, Inject } from '@nestjs/common'
import { eq, and, desc, lt, gt, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { messagesHistory } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
  ) {}

  /**
   * Paginated message history for a chat (jid), newest-first.
   * Reads from the local `messages_history` ledger — NOT from gowa upstream.
   * Use the proxy for live gowa data; use this endpoint for the persisted audit trail.
   */
  async listByChat(
    workspaceId: string,
    jid: string,
    opts: { limit?: number; before?: string; after?: string } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200)
    const conds = [eq(messagesHistory.workspaceId, workspaceId), eq(messagesHistory.jid, jid)]
    if (opts.before) conds.push(lt(messagesHistory.createdAt, new Date(opts.before)))
    if (opts.after) conds.push(gt(messagesHistory.createdAt, new Date(opts.after)))

    const rows = await this.db
      .select()
      .from(messagesHistory)
      .where(and(...conds))
      .orderBy(desc(messagesHistory.createdAt))
      .limit(limit)
    return rows
  }

  async getById(workspaceId: string, messageId: string) {
    const [row] = await this.db
      .select()
      .from(messagesHistory)
      .where(and(eq(messagesHistory.messageId, messageId), eq(messagesHistory.workspaceId, workspaceId)))
      .limit(1)
    return row ?? null
  }

  async stats(workspaceId: string): Promise<{ total: number; inbound: number; outbound: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        inbound: sql<number>`count(*) filter (where ${messagesHistory.direction} = 'INBOUND')::int`,
        outbound: sql<number>`count(*) filter (where ${messagesHistory.direction} = 'OUTBOUND')::int`,
      })
      .from(messagesHistory)
      .where(eq(messagesHistory.workspaceId, workspaceId))
    return row ?? { total: 0, inbound: 0, outbound: 0 }
  }
}
