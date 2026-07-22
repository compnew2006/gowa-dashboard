import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import type { JwtPayload } from '../decorators/current-user.decorator'

export interface RequestWithWorkspace extends Request {
  workspace?: { id: string }
  user?: JwtPayload
}

/**
 * Reads the workspaceId from the JWT (set by the JwtAuthGuard) and attaches
 * it to `request.workspace`. The ProxyInterceptor and tenant-scoped services
 * rely on this. Requires that the JwtAuthGuard runs first.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithWorkspace>()
    const user = request.user
    if (!user || !user.workspaceId) {
      throw new UnauthorizedException('No workspace in token. Re-authenticate.')
    }
    request.workspace = { id: user.workspaceId }
    return true
  }
}
