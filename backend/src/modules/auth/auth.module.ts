import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { CryptoService } from './crypto.service'
import { WsTicketService } from './ws-ticket.service'
import { JwtStrategy } from './jwt.strategy'
import { PermissionsService } from './permissions.service'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [
    PassportModule,
    AuditModule,
    // Registered HERE (not in AppModule) so JwtService is in the AuthModule's
    // DI scope. Async so JWT_SECRET is read from process.env at bootstrap.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, CryptoService, WsTicketService, JwtStrategy, PermissionsService],
  exports: [
    AuthService,
    CryptoService,
    WsTicketService,
    PassportModule,
    JwtModule,
    PermissionsService,
  ],
})
export class AuthModule {}
