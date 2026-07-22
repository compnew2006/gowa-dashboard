import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as bcrypt2 from 'bcryptjs'
import { users, refreshTokens, workspaceMembers, workspaces, roles } from '../../db/schema'
import { DRIZZLE_DB } from '../../db/db.module'

export interface JwtSub {
  sub: string // userId
  email: string
  workspaceId: string
  roleId: string
  roleName?: string // populated on login/rotate; read by RolesGuard
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresJsDatabase<typeof import('../../db/schema')>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ----------------------------- password hashing -----------------------------
  private async hashPassword(plain: string): Promise<string> {
    return bcrypt2.hash(plain, 12)
  }
  private async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt2.compare(plain, hash)
  }

  // ----------------------------- refresh-token hashing -----------------------------
  private hashToken(token: string): string {
    // HMAC-SHA256 keyed by the refresh secret, NOT plain sha256. This makes
    // a stolen DB dump non-reversible without the secret.
    const secret = this.config.get<string>('JWT_REFRESH_SECRET')
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not set.')
    return crypto.createHmac('sha256', secret).update(token).digest('hex')
  }

  // ----------------------------- login -----------------------------
  async login(
    email: string,
    password: string,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<TokenPair> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email))
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials.')
    }
    const ok = await this.verifyPassword(password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Invalid credentials.')

    const membership = await this.resolveMembership(user.id)
    const pair = await this.issueTokens(
      user.id,
      user.email,
      membership.workspaceId,
      membership.roleId,
      null,
      meta,
      membership.roleName,
    )
    return pair
  }

  // ----------------------------- token issuance -----------------------------
  async issueTokens(
    userId: string,
    email: string,
    workspaceId: string,
    roleId: string,
    familyId: string | null,
    meta: { ip?: string; userAgent?: string } = {},
    roleName?: string,
  ): Promise<TokenPair> {
    const payload: JwtSub = { sub: userId, email, workspaceId, roleId, roleName }
    const accessToken = await this.jwt.signAsync(payload)
    const family = familyId ?? crypto.randomUUID()
    const rawRefresh = crypto.randomBytes(40).toString('base64url')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7d

    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: this.hashToken(rawRefresh),
      familyId: family,
      ipAddress: meta.ip ?? null,
      isRevoked: false,
      expiresAt,
    })

    return { accessToken, refreshToken: `${rawRefresh}.${family}` }
  }

  // ----------------------------- rotation with reuse detection -----------------------------
  async rotate(tokenPair: string, meta: { ip?: string; userAgent?: string } = {}): Promise<TokenPair> {
    const [raw, family] = tokenPair.split('.')
    if (!raw || !family) throw new UnauthorizedException('Malformed refresh token.')

    const [record] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, this.hashToken(raw)))

    if (!record) throw new UnauthorizedException('Refresh token not recognised.')

    // REUSE DETECTION: a token that has already been rotated/revoked must never
    // be accepted again. Revoke the whole family on any such attempt.
    if (record.isRevoked || record.replacedByTokenId) {
      await this.db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.familyId, family))
      throw new ForbiddenException(
        'Refresh-token reuse detected. The entire token family has been revoked.',
      )
    }

    if (record.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired.')

    const [user] = await this.db.select().from(users).where(eq(users.id, record.userId))
    if (!user || !user.isActive) throw new UnauthorizedException('User account inactive.')

    const membership = await this.resolveMembership(user.id)

    const newTokenId = crypto.randomUUID()
    const newRaw = crypto.randomBytes(40).toString('base64url')
    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await this.db.transaction(async (tx) => {
      // INSERT the new token FIRST so the FK on replaced_by_token_id is satisfied
      // when we UPDATE the old row below.
      await tx.insert(refreshTokens).values({
        id: newTokenId,
        userId: user.id,
        tokenHash: this.hashToken(newRaw),
        familyId: record.familyId,
        ipAddress: meta.ip ?? null,
        expiresAt: newExpires,
      })
      await tx
        .update(refreshTokens)
        .set({ replacedByTokenId: newTokenId })
        .where(eq(refreshTokens.id, record.id))
    })

    return this.issueTokens(
      user.id,
      user.email,
      membership.workspaceId,
      membership.roleId,
      record.familyId,
      meta,
      membership.roleName,
    ).then((p) => ({ accessToken: p.accessToken, refreshToken: `${newRaw}.${record.familyId}` }))
  }

  // ----------------------------- logout (revoke family) -----------------------------
  async logout(tokenPair: string): Promise<void> {
    const [raw, family] = tokenPair.split('.')
    if (!family) return
    if (raw) {
      // Best-effort: revoke the specific token if found.
      await this.db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.tokenHash, this.hashToken(raw)))
    }
    await this.db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.familyId, family))
  }

  // ----------------------------- registration (first-run / admin invite) -----------------------------
  async register(email: string, password: string, fullName?: string): Promise<{ id: string }> {
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters.')
    const [existing] = await this.db.select().from(users).where(eq(users.email, email))
    if (existing) throw new ForbiddenException('A user with that email already exists.')

    const [defaultWorkspace] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, 'default-workspace'))
    if (!defaultWorkspace) throw new NotFoundException('Default workspace not seeded. Run `npm run seed` first.')

    const [agentRole] = await this.db.select().from(roles).where(eq(roles.name, 'Agent'))
    if (!agentRole) throw new NotFoundException('Agent role not seeded.')

    const passwordHash = await this.hashPassword(password)
    const [user] = await this.db
      .insert(users)
      .values({ email, passwordHash, fullName: fullName ?? null, isActive: true })
      .returning({ id: users.id })

    await this.db
      .insert(workspaceMembers)
      .values({ workspaceId: defaultWorkspace.id, userId: user!.id, roleId: agentRole.id })
      .onConflictDoNothing()

    return { id: user!.id }
  }

  // ----------------------------- helpers -----------------------------
  private async resolveMembership(
    userId: string,
  ): Promise<{ workspaceId: string; roleId: string; roleName: string }> {
    const [membership] = await this.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        roleId: workspaceMembers.roleId,
        roleName: roles.name,
      })
      .from(workspaceMembers)
      .innerJoin(roles, eq(roles.id, workspaceMembers.roleId))
      .where(eq(workspaceMembers.userId, userId))
      .limit(1)
    if (!membership) {
      throw new ForbiddenException('User has no workspace membership. Contact an admin.')
    }
    return {
      workspaceId: membership.workspaceId,
      roleId: membership.roleId,
      roleName: membership.roleName,
    }
  }
}
