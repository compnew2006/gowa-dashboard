import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ProxyInterceptor } from './proxy.interceptor'

@Module({
  imports: [AuthModule],
  providers: [ProxyInterceptor],
  exports: [ProxyInterceptor],
})
export class DevicesModule {}
