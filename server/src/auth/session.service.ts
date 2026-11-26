import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionSubject } from '../data/models';
import { SESSIONS, SessionRepository } from '../data/repositories';
import { hashToken, newToken, safeEqual } from '../common/tokens';
import { readAccessToken, signAccessToken } from './access-token';

export const SESSION_SIGNING_KEY = Symbol('SESSION_SIGNING_KEY');
export const CLOCK = Symbol('CLOCK');

const accessLifetimeSeconds = 15 * 60;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds when [accessToken] expires. */
  expiresAt: number;
}

export interface VerifiedAccess {
  sessionId: string;
  subject: SessionSubject;
  expiresAt: number;
}

/**
 * Own sessions (design 6): a short access token and a rotating refresh token
 * whose hash alone is stored. Reusing an old refresh token revokes the session.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSIONS) private readonly sessions: SessionRepository,
    @Inject(SESSION_SIGNING_KEY) private readonly signingKey: string,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  async issue(subject: SessionSubject, deviceInfo: string): Promise<IssuedTokens> {
    const id = newToken(12);
    const secret = newToken(32);
    await this.sessions.create({
      id,
      subject,
      refreshTokenHash: hashToken(secret),
      deviceInfo: deviceInfo.slice(0, 200),
      createdAt: this.now(),
    });
    return this.tokens(id, subject, secret);
  }

  async verifyAccess(token: string): Promise<VerifiedAccess> {
    const claims = readAccessToken(token, this.signingKey);
    if (!claims || claims.exp <= this.seconds()) {
      throw new UnauthorizedException();
    }
    const session = await this.sessions.get(claims.sid);
    if (!session || session.revokedAt) {
      throw new UnauthorizedException();
    }
    return { sessionId: session.id, subject: session.subject, expiresAt: claims.exp };
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const [id, secret] = refreshToken.split('.');
    const session = id && secret ? await this.sessions.get(id) : undefined;
    if (!session || session.revokedAt) {
      throw new UnauthorizedException();
    }
    if (!safeEqual(session.refreshTokenHash, hashToken(secret))) {
      // An old token came back: someone else may hold the current one.
      await this.sessions.update(id, { revokedAt: this.now() });
      throw new UnauthorizedException();
    }
    const next = newToken(32);
    if (!(await this.sessions.rotateRefresh(id, session.refreshTokenHash, hashToken(next)))) {
      // Another refresh with the same token won the race: treat as reuse.
      await this.sessions.update(id, { revokedAt: this.now() });
      throw new UnauthorizedException();
    }
    return this.tokens(id, session.subject, next);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.update(sessionId, { revokedAt: this.now() });
  }

  async revokeSubject(subjectId: string): Promise<void> {
    await this.sessions.revokeAllFor(subjectId, this.now());
  }

  private tokens(id: string, subject: SessionSubject, secret: string): IssuedTokens {
    const iat = this.seconds();
    const expiresAt = iat + accessLifetimeSeconds;
    const accessToken = signAccessToken(
      { sid: id, sub: subject.id, kind: subject.kind, gid: subject.groupId, iat, exp: expiresAt },
      this.signingKey,
    );
    return { accessToken, refreshToken: `${id}.${secret}`, expiresAt };
  }

  private seconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  }
}
