import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import * as crypto from 'crypto'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Public } from '../../common/decorators/public.decorator'
import { WEBHOOK_QUEUE } from './constants'

const MAX_REPLAY_AGE_MS = 5 * 60 * 1000 // 5 minutes

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)
  private readonly secret: string

  constructor(
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
    config: ConfigService,
  ) {
    const secret = config.get<string>('WEBHOOK_SECRET')
    if (!secret && config.get<string>('NODE_ENV') === 'production') {
      throw new Error('WEBHOOK_SECRET must be set in production.')
    }
    // Dev-only fallback so local webhook tests don't need env setup.
    this.secret = secret || 'dev-webhook-secret'
  }

  /**
   * gowa POSTs signed events here when WHATSAPP_WEBHOOK points at this server.
   * Verify the HMAC-SHA256 of the RAW request body, then enqueue for
   * background processing.
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async handle(
    @Req() req: Request,
    @Headers('x-gowa-signature') signature: string,
    @Headers('x-gowa-timestamp') timestamp: string | undefined,
  ): Promise<{ status: string }> {
    if (!signature) {
      throw new UnauthorizedException('Missing x-gowa-signature.')
    }

    // Replay protection: reject events older than 5 minutes.
    if (timestamp) {
      const ts = Number(timestamp)
      if (Number.isFinite(ts) && Math.abs(Date.now() - ts * 1000) > MAX_REPLAY_AGE_MS) {
        throw new BadRequestException('Webhook timestamp outside replay window.')
      }
    }

    // The rawBody middleware in main.ts captured the original bytes for us.
    const raw = (req as Request & { rawBody?: Buffer }).rawBody
    if (!raw || raw.length === 0) {
      // Body parser had already consumed it. We cannot safely verify — refuse.
      this.logger.warn('rawBody missing — refusing webhook (HMAC unverifiable).')
      throw new UnauthorizedException('Raw body unavailable for signature verification.')
    }

    // Recompute HMAC over the original bytes.
    const expected = crypto.createHmac('sha256', this.secret).update(raw).digest('hex')
    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Signature verification failed.')
    }

    let payload: unknown
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      throw new BadRequestException('Malformed JSON body.')
    }

    await this.queue.add(
      'process-payload',
      { payload, receivedAt: Date.now() },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    )
    return { status: 'enqueued' }
  }
}
