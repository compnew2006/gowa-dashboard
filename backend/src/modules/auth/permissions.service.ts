import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { roles } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'

/**
 * Resolves a user's role permissions on demand. Used by the RolesGuard.
 *
 * We deliberately do NOT cache across requests (NestJS services are singletons
 * but permissions change rarely); the simpler path is one indexed lookup per
 * request. If this becomes hot, swap in a Redis cache with a 60s TTL keyed by
 * roleId.
 */
@Injectable()
export class PermissionsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
  ) {}

  /** Returns the permissions array for a roleId, or [] if the role is gone. */
  async getPermissions(roleId: string): Promise<string[]> {
    const [row] = await this.db
      .select({ permissions: roles.permissions })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1)
    return row?.permissions ?? []
  }

  /**
   * True if the user's permissions satisfy the requirement. SuperAdmin
   * (permissions include the literal '*') always passes.
   */
  static hasPermission(userPermissions: string[], required: string[]): boolean {
    if (userPermissions.includes('*')) return true
    if (required.length === 0) return true
    return required.some((p) => userPermissions.includes(p))
  }

  /** True if the user holds ANY of the required role names. */
  static hasRole(userRoleName: string | undefined, required: string[]): boolean {
    if (required.length === 0) return true
    return !!userRoleName && required.includes(userRoleName)
  }
}
