// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  APP_CHECK_FAILED,
  APP_CHECK_HEADER,
  APP_CHECK_MODE,
  APP_CHECK_VERIFIER,
  IS_PUBLIC_KEY,
} from './app-check.constants';
// `import type`: these appear in a decorated constructor signature and the
// backends compile with isolatedModules + emitDecoratorMetadata (TS1272).
import type { AppCheckMode, AppCheckOutcome } from './app-check.constants';
import type { AppCheckVerifier } from './app-check.verifier';
import { isAppCheckTokenError } from './app-check.verifier';

interface AppCheckRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
  route?: { path?: string };
}

/**
 * Verifies `X-Firebase-AppCheck` on every non-`@Public()` route.
 *
 * `off` does nothing; `monitor` verifies and logs but always allows;
 * `enforce` answers `401 { code: APP_CHECK_FAILED }` when the token is
 * missing or invalid. A failure inside the verifier that is not about the
 * token (admin app missing, network) is logged as `error` and allowed in
 * every mode, so App Check can never take the backend down.
 */
@Injectable()
export class AppCheckGuard implements CanActivate {
  private readonly logger = new Logger('AppCheck');

  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CHECK_MODE) private readonly mode: AppCheckMode,
    @Inject(APP_CHECK_VERIFIER) private readonly verifier: AppCheckVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.mode === 'off') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AppCheckRequest>();
    const { outcome, appId, reason } = await this.check(request);
    this.log(request, outcome, appId, reason);

    const rejected = outcome === 'missing' || outcome === 'invalid';
    if (this.mode === 'enforce' && rejected) {
      throw new UnauthorizedException({
        code: APP_CHECK_FAILED,
        message: 'App Check token is missing or invalid',
      });
    }
    return true;
  }

  private async check(request: AppCheckRequest): Promise<{
    outcome: AppCheckOutcome;
    appId: string | null;
    reason: string | null;
  }> {
    const token = headerValue(request.headers, APP_CHECK_HEADER);
    if (!token) return { outcome: 'missing', appId: null, reason: null };
    try {
      const { appId } = await this.verifier.verify(token);
      return { outcome: 'verified', appId, reason: null };
    } catch (error) {
      const outcome = isAppCheckTokenError(error) ? 'invalid' : 'error';
      return { outcome, appId: null, reason: describe(error) };
    }
  }

  private log(
    request: AppCheckRequest,
    outcome: AppCheckOutcome,
    appId: string | null,
    reason: string | null,
  ): void {
    const entry = {
      event: 'app_check',
      outcome,
      mode: this.mode,
      route: `${request.method} ${routePath(request)}`,
      platform: headerValue(request.headers, 'x-app-platform') ?? null,
      build: headerValue(request.headers, 'x-app-build') ?? null,
      appId,
      reason,
    };
    if (outcome === 'invalid' || outcome === 'error') {
      this.logger.warn(entry);
    } else {
      this.logger.log(entry);
    }
  }
}

function headerValue(
  headers: AppCheckRequest['headers'],
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function routePath(request: AppCheckRequest): string {
  return request.route?.path ?? request.url.split('?')[0];
}

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    if (error instanceof Error) return error.name;
  }
  return 'unknown';
}
