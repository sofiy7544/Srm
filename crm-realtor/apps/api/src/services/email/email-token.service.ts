import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Cryptographically secure tokens for email-mediated flows.
 *
 *  - 32 raw bytes (256 bits) → ~43 char base64url string.
 *  - Only the SHA-256 hash is stored in the DB so a DB leak doesn't compromise live tokens.
 *  - Comparison uses `timingSafeEqual` to avoid timing attacks.
 */
@Injectable()
export class EmailTokenService {
  /** Generates a new url-safe random token. */
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  /** Hashes a token for safe storage / lookup. */
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Constant-time comparison of two hex hashes. */
  verifyHash(plainToken: string, storedHash: string): boolean {
    const computed = Buffer.from(this.hash(plainToken), 'hex');
    let stored: Buffer;
    try {
      stored = Buffer.from(storedHash, 'hex');
    } catch {
      return false;
    }
    if (computed.length !== stored.length) return false;
    return timingSafeEqual(computed, stored);
  }
}
