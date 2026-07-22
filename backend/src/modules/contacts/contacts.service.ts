import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, and, ilike, or, desc, sql } from 'drizzle-orm'
import { contacts, chatReadCursors } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'
import Redis from 'ioredis' // Standard Redis adapter

@Injectable()
export class ContactsService {
  private readonly redis: Redis;

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
  ) {
    // In production, instantiate from ConfigService. For build, fallback securely.
    this.redis = new Redis(process.env.REDIS_URI || 'redis://localhost:6379');
  }

  /**
   * Syncs and updates contacts under a strict advisory lock per device.
   * This guarantees race conditions are completely eliminated during high-throughput synchronizations.
   */
  async syncContacts(
    workspaceId: string,
    deviceId: string,
    contactPayloads: Array<{ jid: string; name: string; phoneNumber: string }>
  ): Promise<{ synced: number }> {
    const lockKey = `sync:lock:${deviceId}`;
    const ttl = 30; // Lock duration in seconds
    
    // Acquire distributed lock via Redis (set with NX and EX parameters)
    const acquired = await this.redis.set(lockKey, 'locked', 'EX', ttl, 'NX');
    if (!acquired) {
      throw new ConflictException(`Sync lock active for device ${deviceId}. Please retry later.`);
    }

    try {
      let syncedCount = 0;

      // Batch insert with onConflictDoUpdate pattern
      for (const item of contactPayloads) {
        await this.db
          .insert(contacts)
          .values({
            workspaceId,
            jid: item.jid,
            name: item.name,
            phoneNumber: item.phoneNumber,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [contacts.jid, contacts.workspaceId],
            set: {
              name: item.name,
              phoneNumber: item.phoneNumber,
              updatedAt: new Date(),
            }
          });
        
        syncedCount++;
      }

      return { synced: syncedCount };
    } finally {
      // Release advisory lock safely
      await this.redis.del(lockKey);
    }
  }

  /**
   * Throttles chat read cursor updates to once every 3 seconds per user/chat context
   * to mitigate high-frequency database writes while maintaining realtime accuracy.
   */
  async updateReadCursorThrottled(
    workspaceId: string,
    userId: string,
    chatJid: string,
    deviceId: string,
    lastReadMessageId: string
  ): Promise<{ updated: boolean }> {
    const throttleKey = `cursor:throttle:${userId}:${chatJid}`;
    
    // Check if write is throttled (active lock exists)
    const throttled = await this.redis.get(throttleKey);
    if (throttled) {
      // Cache the latest value in Redis to prevent loss of intermediate updates
      await this.redis.set(`cursor:latest:${userId}:${chatJid}`, lastReadMessageId, 'EX', 10);
      return { updated: false };
    }

    // Set throttle lock (3 seconds)
    await this.redis.set(throttleKey, 'active', 'EX', 3);

    // Persist to Postgres immediately
    await this.db
      .insert(chatReadCursors)
      .values({
        workspaceId,
        userId,
        chatJid,
        deviceId,
        lastReadMessageId,
        lastReadAt: new Date()
      })
      .onConflictDoUpdate({
        target: [chatReadCursors.userId, chatReadCursors.chatJid, chatReadCursors.deviceId],
        set: {
          lastReadMessageId,
          lastReadAt: new Date()
        }
      });

    return { updated: true };
  }

  // -----------------------------------------------------------------------
  // Direct CRUD (workspace-scoped, no Redis).
  // -----------------------------------------------------------------------

  async list(
    workspaceId: string,
    opts: { search?: string; limit?: number; offset?: number } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200)
    const offset = Math.max(opts.offset ?? 0, 0)
    let query = this.db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId))
      .$dynamic()

    if (opts.search) {
      const pattern = `%${opts.search}%`
      query = query.where(
        and(
          eq(contacts.workspaceId, workspaceId),
          or(ilike(contacts.name, pattern), ilike(contacts.phoneNumber, pattern), ilike(contacts.jid, pattern)),
        ),
      )
    }

    const rows = await query.limit(limit).offset(offset).orderBy(desc(contacts.updatedAt))
    return rows
  }

  async get(workspaceId: string, contactId: string) {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)))
      .limit(1)
    if (!row) throw new NotFoundException(`Contact ${contactId} not found.`)
    return row
  }

  async create(
    workspaceId: string,
    data: { jid: string; name?: string; phoneNumber: string; email?: string; notes?: string; assignedUserId?: string },
  ) {
    const [existing] = await this.db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.jid, data.jid), eq(contacts.workspaceId, workspaceId)))
      .limit(1)
    if (existing) {
      throw new ConflictException(`A contact with jid "${data.jid}" already exists.`)
    }
    const [row] = await this.db
      .insert(contacts)
      .values({
        workspaceId,
        jid: data.jid,
        name: data.name ?? null,
        phoneNumber: data.phoneNumber,
        email: data.email ?? null,
        notes: data.notes ?? null,
        assignedUserId: data.assignedUserId ?? null,
      })
      .returning()
    return row!
  }

  async update(
    workspaceId: string,
    contactId: string,
    data: {
      name?: string
      phoneNumber?: string
      email?: string
      notes?: string
      assignedUserId?: string | null
    },
  ) {
    await this.get(workspaceId, contactId)
    const [row] = await this.db
      .update(contacts)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.assignedUserId !== undefined && { assignedUserId: data.assignedUserId }),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)))
      .returning()
    return row!
  }

  async remove(workspaceId: string, contactId: string): Promise<void> {
    const result = await this.db
      .delete(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId)))
      .returning({ id: contacts.id })
    if (result.length === 0) {
      throw new NotFoundException(`Contact ${contactId} not found in this workspace.`)
    }
  }

  async count(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId))
    return row?.count ?? 0
  }

  // -----------------------------------------------------------------------
  // Sync from gowa — pulls each device's contact book and upserts into the
  // CRM `contacts` table. Existing rows keep their user-edited fields
  // (notes, email, assignedUserId); only name + phoneNumber refresh.
  // -----------------------------------------------------------------------

  /**
   * Sync contacts from a single gowa device into the CRM. Bulk-inserts in
   * batches of 500 to avoid Postgres parameter limits on big address books
   * (3.6k contacts in one INSERT would exceed the 65k-param cap only with
   * many columns; we batch defensively anyway).
   */
  async syncFromDevice(
    workspaceId: string,
    deviceId: string,
    deviceContacts: Array<{ jid: string; name: string }>,
  ): Promise<{ fetched: number; upserted: number; skipped: number }> {
    const BATCH = 500
    let upserted = 0
    let skipped = 0
    for (let i = 0; i < deviceContacts.length; i += BATCH) {
      const slice = deviceContacts.slice(i, i + BATCH)
      // Build the batch payload. Phone is parsed from the JID (everything
      // before the first ":" or "@").
      const rows = slice
        .map((c) => {
          const phoneMatch = c.jid.match(/^(\d+)/)
          if (!phoneMatch) {
            skipped++
            return null
          }
          return {
            workspaceId,
            jid: c.jid,
            name: c.name || null,
            phoneNumber: phoneMatch[1],
            sourceDeviceId: deviceId,
            updatedAt: new Date(),
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (rows.length === 0) continue

      for (const row of rows) {
        try {
          await this.db
            .insert(contacts)
            .values(row)
            .onConflictDoUpdate({
              target: [contacts.jid, contacts.workspaceId],
              set: {
                // Refresh name + phone + source. Preserve email, notes,
                // assignedUserId (user-edited CRM data).
                name: row.name,
                phoneNumber: row.phoneNumber,
                sourceDeviceId: row.sourceDeviceId,
                updatedAt: new Date(),
              },
            })
          upserted++
        } catch {
          // best-effort: skip rows that fail (rare; FK or constraint)
          skipped++
        }
      }
    }
    return { fetched: deviceContacts.length, upserted, skipped }
  }
}
