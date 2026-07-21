import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { AuthModule } from './modules/auth/auth.module'
import { DevicesModule } from './modules/devices/devices.module'
import { ContactsModule } from './modules/contacts/contacts.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'
import { TenancyService } from './db/tenancy.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    DevicesModule,
    ContactsModule,
    WebhooksModule,
  ],
  providers: [
    TenancyService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [TenancyService],
})
export class AppModule {}
