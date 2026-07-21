import { Module } from '@nestjs/common'
import { WebhooksController } from './webhooks.controller'
import { WebhooksProcessor } from './webhooks.processor'

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksProcessor],
  exports: [WebhooksProcessor],
})
export class WebhooksModule {}
