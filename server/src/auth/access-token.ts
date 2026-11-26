import { createHmac } from 'node:crypto';
import { safeEqual } from '../common/tokens';

export interface AccessClaims {
  sid: string;
  sub: string;
  kind: 'organizer' | 'member';
  gid?: string;
  iat: number;
  exp: number;
}

const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function signature(key: string, body: string): string {
  return createHmac('sha256', key).update(body).digest('base64url');
}

/** Compact HS256 JWT. */
export function signAccessToken(claims: AccessClaims, key: string): string {
  const body = `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
  return `${body}.${signature(key, body)}`;
}

/** Claims of a token with a valid signature, or undefined; expiry is checked by the caller. */
export function readAccessToken(token: string, key: string): AccessClaims | undefined {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== header) {
    return undefined;
  }
  if (!safeEqual(parts[2], signature(key, `${parts[0]}.${parts[1]}`))) {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as AccessClaims;
  } catch {
    return undefined;
  }
}
