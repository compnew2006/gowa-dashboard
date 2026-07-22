import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'requiredRoles'
export const PERMISSIONS_KEY = 'requiredPermissions'

/**
 * Restrict a route to users holding ANY of the named roles.
 * Example: `@Roles('SuperAdmin', 'Admin')`.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

/**
 * Restrict a route to users whose role.permissions array includes ANY of the
 * listed permission strings. SuperAdmin (permissions: ['*']) always passes.
 * Example: `@RequirePermissions('users:manage')`.
 *
 * Permission vocabulary (see `db/seed.ts` CORE_ROLES):
 *   workspace:manage | users:manage | devices:admin | devices:read
 *   chats:read | chats:write | contacts:manage | contacts:read | contacts:write
 *   campaigns:manage | campaigns:read | campaigns:write | audit:read
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)
