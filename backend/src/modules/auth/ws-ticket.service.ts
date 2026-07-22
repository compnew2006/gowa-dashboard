import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import * as crypto from 'crypto'

export interface WsTicketPayload {
  userId: string
  workspaceId: string
  deviceId: string // the gowa device JID this ticket is scoped to
}

const TICKET_TTL_SECONDS = 30

/**
 * Issues single-use, short-lived tickets that the browser presents as a
 * `?ticket=` query param when opening the WebSocket. The WS gateway consumes
 * the ticket (DEL) on connection and refuses to relay if it's missing/expired.
 *
 * This replaces the browser's unsafe pattern of putting the Basic-Auth
 * credential in the WS URL — the gateway looks up the gowa credential from
 * the encrypted vault server-side instead.
 */
@Injectable()
export class WsTicketService implements OnModuleInit {
  private redis!: Redis

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Lazily but during module init so connection failures surface at startup.
    const url = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'
    this.redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false })
  }

  async issue(payload: WsTicketPayload): Promise<string> {
    const ticket = crypto.randomBytes(32).toString('base64url')
    const key = this.key(ticket)
    // SET ... NX EX so a collision can't overwrite. TTL enforces one-shot use.
    await this.redis.set(key, JSON.stringify(payload), 'EX', TICKET_TTL_SECONDS, 'NX')
    return ticket
  }

  /** Consume: atomically GET + DEL. Returns null if missing/expired. */
  async consume(ticket: string): Promise<WsTicketPayload | null> {
    if (!ticket) return null
    const key = this.key(ticket)
    const raw = await this.redis.getdel(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as WsTicketPayload
    } catch {
      return null
    }
  }

  private key(ticket: string): string {
    return `ws:ticket:${ticket}`
  }
}
