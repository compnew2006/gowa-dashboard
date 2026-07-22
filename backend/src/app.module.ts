import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD, APP_FILTER } from '@nestjs/core'
import { BullModule } from '@nestjs/bullmq'
import { DrizzleModule } from './db/db.module'
import { AuthModule } from './modules/auth/auth.module'
import { DevicesModule } from './modules/devices/devices.module'
import { ContactsModule } from './modules/contacts/contacts.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'
import { WsGatewayModule } from './modules/ws/ws-gateway.module'
import { UsersModule } from './modules/users/users.module'
import { MessagesModule } from './modules/messages/messages.module'
import { AuditModule } from './modules/audit/audit.module'
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard'
import { JwtStrategy } from './modules/auth/jwt.strategy'
import { PermissionsService } from './modules/auth/permissions.service'
import { RolesGuard } from './common/guards/roles.guard'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        const parsed = new URL(url)
        return {
          connection: {
            host: parsed.hostname,
            port: Number(parsed.port) || 6379,
            password: decodeURIComponent(parsed.password || ''),
          },
        }
      },
    }),
    DrizzleModule,
    AuthModule,
    DevicesModule,
    ContactsModule,
    WebhooksModule,
    WsGatewayModule,
    UsersModule,
    MessagesModule,
    AuditModule,
  ],
  providers: [
    JwtStrategy,
    PermissionsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
