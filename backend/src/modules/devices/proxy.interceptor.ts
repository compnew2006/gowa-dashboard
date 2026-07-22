import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException, UnauthorizedException } from '@nestjs/common'
import { Observable } from 'rxjs'
import { DevicesService } from './devices.service'
import { CryptoService } from '../auth/crypto.service'

/**
 * Optional interceptor that pre-resolves device credentials and stashes them
 * on the request so handlers can avoid a second lookup.
 *
 * The gowa-proxy controller does its own resolution inline (so it owns the
 * exact failure modes), but this interceptor is kept available for any future
 * controller that wants pre-resolved creds on `request.resolvedDevice`.
 */
@Injectable()
export class ProxyInterceptor implements NestInterceptor {
  constructor(private readonly devices: DevicesService, private readonly crypto: CryptoService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest()
    const workspaceId = request.workspace?.id || request.user?.workspaceId
    if (!workspaceId) {
      throw new UnauthorizedException('Request must be scoped within a valid workspace context.')
    }
    const deviceId = request.headers['x-device-id'] || request.query['device_id']
    if (!deviceId) {
      throw new BadRequestException('Targeting device header (X-Device-Id) is required.')
    }
    request.resolvedDevice = await this.devices.resolveCredentials(workspaceId, deviceId)
    return next.handle()
  }
}
