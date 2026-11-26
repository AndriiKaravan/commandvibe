import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A new 128-bit random token, URL-safe (design 6: invite and group link tokens). */
export function newToken(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex; only this is ever stored. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
