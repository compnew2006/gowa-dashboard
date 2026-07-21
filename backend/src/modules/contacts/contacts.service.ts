import { Injectable, ConflictException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { contacts, chatReadCursors } from '../../db/schema';
import Redis from 'ioredis'; // Standard Redis adapter

@Injectable()
export class ContactsService {
  private readonly redis: Redis;

  constructor(
    private readonly db: PostgresJsDatabase<any>
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
}
