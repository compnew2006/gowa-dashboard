import { Module } from '@nestjs/common'
import { WsGateway } from './ws-gateway'
import { AuthModule } from '../auth/auth.module'
import { DevicesModule } from '../devices/devices.module'

@Module({
  imports: [AuthModule, DevicesModule],
  providers: [WsGateway],
  exports: [],
})
export class WsGatewayModule {}
