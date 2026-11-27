import { PhotoUrlClaims, PhotoUrlSigner, derivePhotoUrlKey } from './photo-url';

const sessionKey = Buffer.alloc(64, 7);
const claims: PhotoUrlClaims = { g: 'g1', d: 2, a: 'author', v: 'ver1', x: 'photo', k: 'member', s: 'viewer' };
const now = new Date('2026-12-01T10:02:30Z');
const tokenOf = (url: string): string => url.replace('/p/', '');

describe('PhotoUrlSigner', () => {
  const signer = new PhotoUrlSigner(derivePhotoUrlKey(sessionKey));

  it('should verify what it signed', () => {
    expect(signer.verify(tokenOf(signer.sign(claims, now)), now)).toEqual(claims);
  });

  it('should reject a token with any byte changed', () => {
    const token = tokenOf(signer.sign(claims, now));
    for (const index of [0, 5, token.length - 3, token.length - 1]) {
      const flipped = token.slice(0, index) + (token[index] === 'A' ? 'B' : 'A') + token.slice(index + 1);
      expect(signer.verify(flipped, now)).toBeUndefined();
    }
    expect(signer.verify('garbage', now)).toBeUndefined();
    expect(signer.verify('', now)).toBeUndefined();
  });

  it('should reject an expired token', () => {
    const token = tokenOf(signer.sign(claims, now));
    expect(signer.verify(token, new Date(now.getTime() + 11 * 60_000))).toBeUndefined();
  });

  it('should give the same link inside one five-minute window', () => {
    const a = signer.sign(claims, new Date('2026-12-01T10:00:01Z'));
    const b = signer.sign(claims, new Date('2026-12-01T10:04:59Z'));
    expect(a).toBe(b);
    expect(signer.sign(claims, new Date('2026-12-01T10:05:01Z'))).not.toBe(a);
  });

  it('should live between five and ten minutes', () => {
    for (const offsetSeconds of [0, 1, 150, 299, 300, 301, 3599]) {
      const at = new Date(Date.UTC(2026, 11, 1, 10, 0, 0) + offsetSeconds * 1000);
      const life = (signer.expiresAt(at).getTime() - at.getTime()) / 1000;
      expect(life).toBeGreaterThan(299);
      expect(life).toBeLessThanOrEqual(600);
    }
  });

  it('should not accept a token signed with the raw session key', () => {
    const raw = new PhotoUrlSigner(sessionKey);
    expect(signer.verify(tokenOf(raw.sign(claims, now)), now)).toBeUndefined();
  });

  it('should return a path under /p/', () => {
    expect(signer.sign(claims, now).startsWith('/p/')).toBe(true);
  });
});
