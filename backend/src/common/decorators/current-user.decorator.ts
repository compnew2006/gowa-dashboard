import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface JwtPayload {
  sub: string // userId
  email: string
  workspaceId: string
  roleId: string
  roleName?: string // populated on login/rotate; read by RolesGuard
  // set by refresh/issue flows:
  familyId?: string
}

/**
 * Extract the authenticated JWT payload from the request.
 * `request.user` is populated by the Passport-JWT strategy.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | unknown => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as JwtPayload
    return data ? user?.[data] : user
  },
)
