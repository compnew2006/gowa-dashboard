import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { DevicesService } from './devices.service'
import { RegisterDeviceDto } from './dto/register-device.dto'
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator'
import { WorkspaceGuard, type RequestWithWorkspace } from '../../common/guards/workspace.guard'

/**
 * Manages the ENCRYPTED DEVICE VAULT. These are NestJS-side device records
 * (credential store). The actual gowa device state lives behind the proxy at
 * GET /api/v1/proxy/devices.
 */
@Controller('devices')
@UseGuards(WorkspaceGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@CurrentUser() user: JwtPayload) {
    const list = await this.devices.list(user.workspaceId)
    return { code: 'ok', message: 'devices', results: list }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    const device = await this.devices.register(user.workspaceId, dto)
    return { code: 'ok', message: 'device registered', results: device }
  }

  @Delete(':deviceId')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: JwtPayload, @Param('deviceId') deviceId: string) {
    await this.devices.remove(user.workspaceId, deviceId)
    return { code: 'ok', message: 'device removed', results: null }
  }
}
