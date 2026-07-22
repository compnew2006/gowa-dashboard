import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ProxyInterceptor } from './proxy.interceptor'
import { DevicesService } from './devices.service'
import { DevicesController } from './devices.controller'
import { GowaClientService } from './gowa-client.service'

@Module({
  imports: [AuthModule],
  controllers: [DevicesController],
  providers: [DevicesService, ProxyInterceptor, GowaClientService],
  exports: [DevicesService, ProxyInterceptor, GowaClientService],
})
export class DevicesModule {}
