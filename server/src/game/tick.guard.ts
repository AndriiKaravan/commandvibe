import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

/** Which Cloud Scheduler identity may call the tick; both unset means the tick is switched off. */
export interface TickConfig {
  /** The URL Scheduler puts in the token's `aud` claim. */
  audience?: string;
  /** Service account email of the Scheduler job. */
  invoker?: string;
}

export const TICK_CONFIG = Symbol('TICK_CONFIG');
export const OIDC_VERIFIER = Symbol('OIDC_VERIFIER');

export interface OidcVerifier {
  /** Verifies a Google-signed ID token for [audience]; throws when it is invalid. */
  verify(token: string, audience: string): Promise<{ email?: string; emailVerified?: boolean }>;
}

@Injectable()
export class GoogleOidcVerifier implements OidcVerifier {
  private readonly client = new OAuth2Client();

  async verify(token: string, audience: string): Promise<{ email?: string; emailVerified?: boolean }> {
    const ticket = await this.client.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    return { email: payload?.email, emailVerified: payload?.email_verified };
  }
}

/** Lets only the configured Cloud Scheduler service account through; invisible while unconfigured. */
@Injectable()
export class TickGuard implements CanActivate {
  constructor(
    @Inject(TICK_CONFIG) private readonly config: TickConfig,
    @Inject(OIDC_VERIFIER) private readonly verifier: OidcVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { audience, invoker } = this.config;
    if (!audience || !invoker) {
      throw new NotFoundException();
    }
    const header = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    try {
      const claims = await this.verifier.verify(value.slice('Bearer '.length), audience);
      if (claims.email === invoker && claims.emailVerified === true) {
        return true;
      }
    } catch {
      // An invalid token is the same answer as a wrong identity.
    }
    throw new UnauthorizedException();
  }
}
