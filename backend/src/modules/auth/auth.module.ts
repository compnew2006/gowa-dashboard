import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { CryptoService } from './crypto.service'

@Module({
  providers: [AuthService, CryptoService],
  exports: [AuthService, CryptoService],
})
export class AuthModule {}
