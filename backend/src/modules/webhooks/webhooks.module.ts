import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { WebhooksController } from './webhooks.controller'
import { WebhooksProcessor } from './webhooks.processor'
import { WEBHOOK_QUEUE } from './constants'

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE })],
  controllers: [WebhooksController],
  providers: [WebhooksProcessor],
  exports: [WebhooksProcessor],
})
export class WebhooksModule {}
