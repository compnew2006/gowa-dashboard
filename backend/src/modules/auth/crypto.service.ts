import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly masterKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor() {
    // Obtain master encryption key from environment, fallback securely for testing
    const secret = process.env.ENCRYPTION_MASTER_KEY;
    if (!secret) {
      // In production, missing master key will fail application initialization safely
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_MASTER_KEY is not defined in production environment!');
      }
      // Seed development fallback
      this.masterKey = crypto.scryptSync('dev-fallback-secret', 'gowa-salt', 32);
    } else {
      this.masterKey = crypto.scryptSync(secret, 'gowa-salt', 32);
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * Returns IV, ciphertext, and authorization tag for integrity assurance.
   */
  encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
    try {
      const iv = crypto.randomBytes(12); // GCM standard IV size
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv) as crypto.DecipherGCM;

      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      const tag = cipher.getAuthTag().toString('hex');

      return {
        ciphertext,
        iv: iv.toString('hex'),
        tag,
      };
    } catch (err: any) {
      throw new InternalServerErrorException(`Encryption failure: ${err.message}`);
    }
  }

  /**
   * Decrypts ciphertext using AES-256-GCM with integrity verification.
   * Throws an exception if ciphertext tampering or key misalignment is detected.
   */
  decrypt(ciphertext: string, ivHex: string, tagHex: string): string {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv) as crypto.DecipherGCM;

      decipher.setAuthTag(tag);

      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Decryption failure: Verification tag mismatch or corrupt payload. (${err.message})`
      );
    }
  }
}
