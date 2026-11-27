import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { SubjectKind } from '../data/models';

export interface PhotoUrlClaims {
  /** Group. */
  g: string;
  /** Day index. */
  d: number;
  /** Author member id. */
  a: string;
  /** Submission version. */
  v: string;
  /** Which file. */
  x: 'photo' | 'blur';
  /** Kind of the viewer. */
  k: SubjectKind;
  /** Viewer id. */
  s: string;
}

const windowSeconds = 300;
const graceSeconds = 600;

/** A separate key per purpose, so no new secret is needed and a session key never signs photo links. */
export function derivePhotoUrlKey(sessionSigningKey: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', sessionSigningKey, '', 'commandvibe/photo-url/v1', 32));
}

const encode = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

/**
 * Short-lived links to photo files. The expiry is quantised to five-minute windows, so the same link is handed out
 * within a window and browsers can cache it. The link only proves the server once agreed; it is checked again on use.
 */
export class PhotoUrlSigner {
  constructor(private readonly key: Buffer) {}

  expiresAt(now: Date): Date {
    const seconds = Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds + graceSeconds;
    return new Date(seconds * 1000);
  }

  sign(claims: PhotoUrlClaims, now: Date): string {
    const body = encode(JSON.stringify({ ...claims, e: this.expiresAt(now).getTime() / 1000 }));
    return `/p/${body}.${this.mac(body)}`;
  }

  verify(token: string, now: Date): PhotoUrlClaims | undefined {
    return this.verifyWithExpiry(token, now)?.claims;
  }

  /** Like [verify], also telling when the link stops working (for cache headers). */
  verifyWithExpiry(token: string, now: Date): { claims: PhotoUrlClaims; expiresAt: Date } | undefined {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra !== undefined) {
      return undefined;
    }
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PhotoUrlClaims & { e: number };
      if (typeof parsed.e !== 'number' || parsed.e * 1000 <= now.getTime()) {
        return undefined;
      }
      return {
        claims: { g: parsed.g, d: parsed.d, a: parsed.a, v: parsed.v, x: parsed.x, k: parsed.k, s: parsed.s },
        expiresAt: new Date(parsed.e * 1000),
      };
    } catch {
      return undefined;
    }
  }

  private mac(body: string): string {
    return encode(createHmac('sha256', this.key).update(body).digest());
  }
}
