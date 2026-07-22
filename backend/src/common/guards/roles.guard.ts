import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY, PERMISSIONS_KEY } from '../decorators/roles.decorator'
import { PermissionsService } from '../../modules/auth/permissions.service'
import type { JwtPayload } from '../decorators/current-user.decorator'

/**
 * Enforces `@Roles(...)` and `@RequirePermissions(...)` on a route.
 *
 * The JWT payload (`request.user`) carries `roleId`. We look up the role's
 * permissions once per request and check both decorators. If neither decorator
 * is present, the guard passes (access control is opt-in per route).
 *
 * Requires JwtAuthGuard to have populated `request.user` first.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const requiredPermissions = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )

    // No decorator on this route → no role check (JwtAuthGuard already verified auth).
    if (!requiredRoles && !requiredPermissions) return true

    const request = context.switchToHttp().getRequest()
    const user = request.user as JwtPayload & { roleName?: string }
    if (!user) {
      throw new ForbiddenException('No authenticated user on request.')
    }

    const userPermissions = await this.permissionsService.getPermissions(user.roleId)

    if (
      requiredRoles &&
      !PermissionsService.hasRole(user.roleName, requiredRoles) &&
      !userPermissions.includes('*')
    ) {
      this.logger.warn(
        `User ${user.sub} (role ${user.roleName || '?'}) denied: requires role [${requiredRoles.join(', ')}]`,
      )
      throw new ForbiddenException(
        `This action requires one of the roles: ${requiredRoles.join(', ')}.`,
      )
    }

    if (
      requiredPermissions &&
      !PermissionsService.hasPermission(userPermissions, requiredPermissions)
    ) {
      this.logger.warn(
        `User ${user.sub} denied: requires permission [${requiredPermissions.join(', ')}]`,
      )
      throw new ForbiddenException(
        `This action requires one of the permissions: ${requiredPermissions.join(', ')}.`,
      )
    }

    return true
  }
}
