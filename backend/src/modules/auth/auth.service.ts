import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users, refreshTokens } from '../../db/schema';

export interface JwtPayload {
  userId: string;
  workspaceId: string;
  roleId: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a new access token (JWT payload mockup) and rotating refresh token pair.
   */
  async generateTokens(userId: string, workspaceId: string, roleId: string, familyId: string | null = null): Promise<{ accessToken: string; refreshToken: string }> {
    const actFamilyId = familyId || crypto.randomUUID();
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const hashedRefreshToken = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Days expiry

    await this.db.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashedRefreshToken,
      familyId: actFamilyId,
      expiresAt,
    });

    // Mock access token (in real production, signed via @nestjs/jwt)
    const mockAccessToken = Buffer.from(
      JSON.stringify({ userId, workspaceId, roleId, exp: Date.now() + 15 * 60 * 1000 })
    ).toString('base64');

    return {
      accessToken: mockAccessToken,
      refreshToken: `${rawRefreshToken}.${actFamilyId}`,
    };
  }

  /**
   * Refreshes access tokens and rotates refresh tokens with robust REUSE DETECTION.
   */
  async rotateRefreshToken(tokenPair: string): Promise<{ accessToken: string; refreshToken: string }> {
    const [rawToken, familyId] = tokenPair.split('.');
    if (!rawToken || !familyId) {
      throw new UnauthorizedException('Malformed refresh token structure.');
    }

    const hashedInputToken = this.hashToken(rawToken);

    // Retrieve token record
    const [tokenRecord] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashedInputToken));

    if (!tokenRecord) {
      throw new UnauthorizedException('Token is invalid or expired.');
    }

    // REUSE DETECTION: If token is already marked as revoked or replaced, trigger alarm!
    if (tokenRecord.isRevoked || tokenRecord.replacedByTokenId) {
      // BREACH PROTOCOL: Revoke the ENTIRE token family instantly to defend the tenant
      await this.db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.familyId, familyId));

      throw new ForbiddenException('Security Breach Detected: Attempted reuse of a rotated refresh token. Family revoked.');
    }

    // Check expiry
    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    // Generate new rotated token pair
    // Get user's default/current roles & workspace metadata (Mocked or queried)
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, tokenRecord.userId));

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account inactive.');
    }

    const newTokenId = crypto.randomUUID();
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHashedRefreshToken = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Perform transaction to rotate token record
    await this.db.transaction(async (tx) => {
      // 1. Mark existing token as replaced by new token
      await tx
        .update(refreshTokens)
        .set({ replacedByTokenId: newTokenId })
        .where(eq(refreshTokens.id, tokenRecord.id));

      // 2. Insert new token inside same family
      await tx.insert(refreshTokens).values({
        id: newTokenId,
        userId: user.id,
        tokenHash: newHashedRefreshToken,
        familyId: tokenRecord.familyId,
        expiresAt: newExpiresAt,
      });
    });

    const mockAccessToken = Buffer.from(
      JSON.stringify({ userId: user.id, workspaceId: 'default-ws', roleId: 'default-role', exp: Date.now() + 15 * 60 * 1000 })
    ).toString('base64');

    return {
      accessToken: mockAccessToken,
      refreshToken: `${newRawRefreshToken}.${tokenRecord.familyId}`,
    };
  }
}
