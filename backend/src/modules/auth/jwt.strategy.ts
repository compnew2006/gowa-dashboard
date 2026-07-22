import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtSub } from './auth.service'

/**
 * Validates the Bearer JWT on every protected route. `request.user` becomes
 * the decoded `JwtSub`. The WorkspaceGuard reads `user.workspaceId` from it.
 *
 * Reads the secret from `process.env` directly (not ConfigService) so it works
 * both at runtime (main.ts loads dotenv first) and in tests.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET is not set (check .env / environment).')
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: JwtSub): Promise<JwtSub> {
    if (!payload.sub || !payload.workspaceId) {
      throw new UnauthorizedException('Malformed token.')
    }
    return payload
  }
}
