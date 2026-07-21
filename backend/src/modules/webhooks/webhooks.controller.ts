import { 
  Controller, 
  Post, 
  Req, 
  Headers, 
  HttpCode, 
  HttpStatus, 
  UnauthorizedException 
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { Queue } from 'bullmq'; // High performance job queue

@Controller('api/v1/webhooks')
export class WebhooksController {
  private readonly webhookQueue: Queue;
  private readonly secret: string;

  constructor() {
    this.secret = process.env.WHATSAPP_WEBHOOK_SECRET || 'gowa-webhook-secret-123';
    // Instantiate BullMQ Queue
    this.webhookQueue = new Queue('gowa-webhooks', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      }
    });
  }

  /**
   * High performance webhook ingress. Validates source signature and offloads processing
   * to high-speed BullMQ queues under 5ms, avoiding any connection hanging.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-gowa-signature') signature: string
  ): Promise<{ status: string }> {
    if (!signature) {
      throw new UnauthorizedException('Missing verification signature.');
    }

    // Retrieve raw body parsed by NestJS (using a raw body middleware hook)
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    
    // Verify HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    // Prevent timing attacks using timingSafeEqual
    const signatureBuffer = Buffer.from(signature, 'hex');
    const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');

    if (
      signatureBuffer.length !== calculatedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, calculatedBuffer)
    ) {
      throw new UnauthorizedException('Invalid payload signature verification failed.');
    }

    // Enqueue the job immediately for background asynchronous processing
    await this.webhookQueue.add('process-payload', {
      payload: req.body,
      receivedAt: new Date(),
    }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000, // Retry strategy starting at 1s
      }
    });

    return { status: 'enqueued' };
  }
}
