import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

export const CURRENT_KEY_ID = 'v1'

/**
 * AES-256-GCM credential vault. Used to encrypt the gowa Basic-Auth password
 * before it is stored in the `devices` table, and to decrypt it again on each
 * proxied request.
 *
 * Key handling (improvements over the original scaffold):
 *  - The master key is derived LAZILY on first use (scryptSync is heavy; doing
 *    it in the constructor blocked the event loop during Nest bootstrap).
 *  - In production, `ENCRYPTION_MASTER_KEY` is required — no in-source
 *    fallback that would silently weaken every encrypted secret.
 *  - The salt is `gowa-crm/v1` (versioned so a future key rotation can use a
 *    different salt under a new key id without re-deriving the old key).
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private masterKey: Buffer | null = null

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Eagerly derive once during startup (allowed — happens once, outside the
    // hot path) so the first proxy request doesn't pay the scrypt cost.
    this.key()
  }

  private key(): Buffer {
    if (this.masterKey) return this.masterKey
    const isProd = this.config.get<string>('NODE_ENV') === 'production'
    const secret = this.config.get<string>('ENCRYPTION_MASTER_KEY')
    if (!secret) {
      if (isProd) {
        throw new InternalServerErrorException(
          'ENCRYPTION_MASTER_KEY is not set. The device vault cannot be initialised.',
        )
      }
      // Dev-only deterministic key so local tests don't require env setup.
      const devKey = crypto.scryptSync('dev-only-do-not-use-in-prod', 'gowa-crm/v1', 32)
      this.masterKey = devKey
      return devKey
    }
    this.masterKey = crypto.scryptSync(secret, 'gowa-crm/v1', 32)
    return this.masterKey
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string; keyId: string } {
    try {
      const iv = crypto.randomBytes(12) // 96-bit nonce — standard for GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key(), iv)
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
      ciphertext += cipher.final('hex')
      const tag = cipher.getAuthTag().toString('hex')
      return { ciphertext, iv: iv.toString('hex'), tag, keyId: CURRENT_KEY_ID }
    } catch (err) {
      throw new InternalServerErrorException(`Encryption failure: ${(err as Error).message}`)
    }
  }

  decrypt(ciphertext: string, ivHex: string, tagHex: string): string {
    try {
      const iv = Buffer.from(ivHex, 'hex')
      const tag = Buffer.from(tagHex, 'hex')
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key(), iv)
      decipher.setAuthTag(tag)
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8')
      plaintext += decipher.final('utf8')
      return plaintext
    } catch (err) {
      throw new InternalServerErrorException(
        `Decryption failure (tag mismatch or corrupt payload): ${(err as Error).message}`,
      )
    }
  }
}
