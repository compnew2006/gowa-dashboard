import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq'; // High speed background worker
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { messagesHistory, contacts } from '../../db/schema';
import { GoogleGenAI, Type } from '@google/genai';
import Redis from 'ioredis';

@Injectable()
export class WebhooksProcessor {
  private readonly logger = new Logger(WebhooksProcessor.name);
  private readonly ai: GoogleGenAI;
  private readonly redis: Redis;
  private readonly dlqQueue: any; // Dead Letter Queue representation

  constructor(private readonly db: PostgresJsDatabase<any>) {
    // Initialise Gemini SDK with strict User-Agent telemetry headers
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || 'mock-api-key',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    this.redis = new Redis(process.env.REDIS_URI || 'redis://localhost:6379');

    // Instantiate high-speed Worker to process 'gowa-webhooks'
    new Worker('gowa-webhooks', async (job) => {
      await this.processJob(job);
    }, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      }
    });
  }

  /**
   * Helper to strip PII (Personal Identifiable Information) from text content
   * to guarantee privacy compliance before sending text context to AI processing.
   */
  private scrubPII(text: string): string {
    if (!text) return '';
    let sanitized = text;

    // Mask Credit Card Numbers (Luhn-like patterns)
    sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CREDIT_CARD_REDACTED]');

    // Mask Emails
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');

    // Mask Phone Numbers (simple international & local patterns)
    sanitized = sanitized.replace(/\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g, '[PHONE_REDACTED]');

    return sanitized;
  }

  /**
   * Main background job processor. Runs in isolated context under BullMQ.
   */
  async processJob(job: Job): Promise<void> {
    const { payload, receivedAt } = job.data;
    this.logger.log(`Processing webhook job ${job.id}...`);

    try {
      // Structure of gowa webhook message payload:
      // { workspaceId, deviceId, messageId, jid, direction, text, type }
      const workspaceId = payload.workspaceId || 'default-ws';
      const deviceId = payload.deviceId || 'default-device';
      const messageId = payload.messageId || `msg-${Date.now()}`;
      const jid = payload.jid;
      const direction = payload.direction; // 'INBOUND' | 'OUTBOUND'
      const rawText = payload.text || '';
      const messageType = payload.type || 'TEXT';

      if (!jid) {
        throw new Error('Message payload JID is empty. Unable to index.');
      }

      // 1. Safe PII scrubbing for DB summaries and safety boundaries
      const contentSummary = this.scrubPII(rawText);

      let intent = 'UNKNOWN';
      let confidence = 0.0;
      let sentiment = 'NEUTRAL';

      // 2. Query Gemini AI for intent parsing if it's an INBOUND user message
      if (direction === 'INBOUND' && rawText && process.env.GEMINI_API_KEY) {
        try {
          const response = await this.ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `Analyze the following customer WhatsApp message and extract the primary intent, sentiment, and confidence level. Message: "${contentSummary}"`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intent: { 
                    type: Type.STRING, 
                    description: 'E.g., BILLING, SUPPORT, GREETING, SALES, CANCEL' 
                  },
                  confidence: { 
                    type: Type.NUMBER, 
                    description: 'Score from 0.0 to 1.0' 
                  },
                  sentiment: { 
                    type: Type.STRING, 
                    description: 'POSITIVE, NEUTRAL, NEGATIVE' 
                  },
                },
                required: ['intent', 'confidence', 'sentiment']
              }
            }
          });

          if (response.text) {
            const parsed = JSON.parse(response.text.trim());
            intent = parsed.intent;
            confidence = parsed.confidence;
            sentiment = parsed.sentiment;
          }
        } catch (aiErr: any) {
          this.logger.error(`AI Intent Parsing Failed: ${aiErr.message}. Falling back to default values.`);
        }
      }

      // 3. Persist the message record into the historic message ledger
      await this.db.insert(messagesHistory).values({
        workspaceId,
        messageId,
        jid,
        deviceId,
        direction,
        messageType,
        status: 'RECEIVED',
        contentSummary,
        createdAt: new Date(receivedAt),
      });

      // 4. Update the contact CRM tag dynamically based on extracted intent
      if (direction === 'INBOUND' && intent !== 'UNKNOWN' && confidence > 0.7) {
        // Find existing contact
        const [contact] = await this.db
          .select()
          .from(contacts)
          .where(eq(contacts.jid, jid));

        if (contact) {
          await this.db
            .update(contacts)
            .set({
              notes: `[AI Classification]: Intent: ${intent} (${sentiment}) Confidence: ${Math.round(confidence * 100)}% on ${new Date().toISOString()}`,
              updatedAt: new Date()
            })
            .where(eq(contacts.id, contact.id));
        }
      }

    } catch (err: any) {
      this.logger.error(`Job ${job.id} failed. Attempt: ${job.attemptsMade}. Error: ${err.message}`);
      
      // If job has exceeded all attempts, route to Dead Letter Queue (DLQ) for auditing
      if (job.attemptsMade >= 5) {
        this.logger.warn(`Job ${job.id} exceeded maximum retries. Route to DLQ.`);
        await this.routeToDLQ(job, err);
      }
      
      throw err; // Fail-fast to trigger BullMQ's automatic exponential retry
    }
  }

  /**
   * Dead Letter Queue router for unrecoverable errors.
   */
  private async routeToDLQ(job: Job, error: Error): Promise<void> {
    const dlqKey = 'dlq:webhooks:failed';
    const failedPayload = {
      jobId: job.id,
      data: job.data,
      failedAt: new Date(),
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
    // Push failed payloads into redis failure list for human resolution
    await this.redis.lpush(dlqKey, JSON.stringify(failedPayload));
  }
}
