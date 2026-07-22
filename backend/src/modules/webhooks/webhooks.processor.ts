import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common'
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { Job, Queue } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import Redis from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { messagesHistory, contacts } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'
import { WEBHOOK_QUEUE } from './constants'

interface GowaWebhookPayload {
  event: string
  device_id?: string
  payload?: {
    message?: { id?: string; jid?: string; text?: string; type?: string; from_me?: boolean }
    [k: string]: unknown
  }
  [k: string]: unknown
}

@Injectable()
@Processor(WEBHOOK_QUEUE, { concurrency: 4 })
export class WebhooksProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(WebhooksProcessor.name)
  private readonly dlqRedis: Redis
  private readonly aiEnabled: boolean

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
    @InjectQueue(WEBHOOK_QUEUE) private readonly dlqQueue: Queue,
    private readonly config: ConfigService,
  ) {
    super()
    this.dlqRedis = new Redis(config.get<string>('REDIS_URL') || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
    })

    // Only enable AI enrichment when explicitly opted in AND an API key exists.
    const wantAi = config.get<string>('AI_INTENT_ENABLED') === 'true'
    const hasKey = !!config.get<string>('GEMINI_API_KEY')
    this.aiEnabled = wantAi && hasKey
    if (wantAi && !hasKey) {
      this.logger.warn('AI_INTENT_ENABLED=true but GEMINI_API_KEY is unset. Disabling AI path.')
    }
  }

  onModuleInit(): void {
    this.logger.log(`Webhook processor online (AI intent: ${this.aiEnabled ? 'ON' : 'OFF'}).`)
  }

  async process(job: Job): Promise<void> {
    const data = job.data as { payload: GowaWebhookPayload; receivedAt: number }
    const payload = data.payload
    if (!payload || typeof payload !== 'object') {
      throw new Error('Webhook payload is not an object.')
    }

    const event = payload.event || 'unknown'
    const deviceId = payload.device_id || 'unknown'
    const message = payload.payload?.message
    const messageId = message?.id || `msg-${Date.now()}`
    const jid = message?.jid || ''
    const text = message?.text || ''
    const type = message?.type || 'TEXT'
    const direction = message?.from_me ? 'OUTBOUND' : 'INBOUND'

    if (!jid) {
      this.logger.debug(`Skip ${event}: no jid in payload.`)
      return
    }

    const contentSummary = this.scrubPII(text)

    // Persist to the message ledger (idempotent on message_id via unique index).
    await this.db
      .insert(messagesHistory)
      .values({
        workspaceId: '00000000-0000-0000-0000-000000000000' as any, // see note
        messageId,
        jid,
        deviceId: deviceId as any, // device_id column is uuid FK; relax for raw ingest
        direction,
        messageType: type,
        status: 'RECEIVED',
        contentSummary,
        createdAt: new Date(data.receivedAt),
      })
      .onConflictDoNothing({ target: messagesHistory.messageId })

    // AI enrichment is OPT-IN and only attempted for inbound text messages.
    if (this.aiEnabled && direction === 'INBOUND' && text) {
      await this.enrichWithIntent(jid, contentSummary)
    }
  }

  /**
   * NOTE: this processor is intentionally light on tenancy binding. The
   * `workspaceId` and `deviceId` here are placeholders because gowa's webhook
   * payload does not carry our internal workspace/device UUIDs — it carries
   * the gowa device JID. A future enhancement maps JID -> workspace/device.
   * For now the message is stored as raw telemetry for audit/debugging only.
   */

  private async enrichWithIntent(jid: string, text: string): Promise<void> {
    // Lazy-load GoogleGenAI only when actually invoked.
    try {
      const { GoogleGenAI, Type } = await import('@google/genai')
      const apiKey = this.config.get<string>('GEMINI_API_KEY')
      if (!apiKey) return
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash', // FIXED: the scaffold used 'gemini-3.6-flash' which does not exist
        contents: `Classify this WhatsApp message. Reply JSON with intent, confidence (0..1), sentiment. Message: "${text}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              sentiment: { type: Type.STRING },
            },
            required: ['intent', 'confidence', 'sentiment'],
          },
        },
      })
      if (response.text) {
        const parsed = JSON.parse(response.text) as { intent: string; confidence: number; sentiment: string }
        if (parsed.confidence > 0.7) {
          const [contact] = await this.db.select().from(contacts).where(eq(contacts.jid, jid))
          if (contact) {
            await this.db
              .update(contacts)
              .set({
                notes: `[AI ${new Date().toISOString()}] intent=${parsed.intent} (${parsed.sentiment}) @${Math.round(parsed.confidence * 100)}%`,
                updatedAt: new Date(),
              })
              .where(eq(contacts.id, contact.id))
          }
        }
      }
    } catch (err) {
      this.logger.warn(`AI enrichment failed (continuing): ${(err as Error).message}`)
    }
  }

  private scrubPII(text: string): string {
    if (!text) return ''
    let out = text
    out = out.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CREDIT_CARD_REDACTED]')
    out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL_REDACTED]')
    out = out.replace(/\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g, '[PHONE_REDACTED]')
    return out
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    if (!job) return
    this.logger.error(`Job ${job.id} failed (attempts=${job.attemptsMade}): ${err.message}`)
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.routeToDLQ(job, err).catch(() => void 0)
    }
  }

  private async routeToDLQ(job: Job, err: Error): Promise<void> {
    await this.dlqRedis.lpush(
      'dlq:webhooks:failed',
      JSON.stringify({
        jobId: job.id,
        data: job.data,
        failedAt: new Date().toISOString(),
        error: { name: err.name, message: err.message, stack: err.stack },
      }),
    )
    this.logger.warn(`Job ${job.id} routed to DLQ.`)
  }
}
