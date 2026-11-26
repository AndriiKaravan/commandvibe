// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppCheckMode } from './app-check.constants';
import { AppCheckGuard } from './app-check.guard';
import { AppCheckVerifier } from './app-check.verifier';

type Headers = Record<string, string>;

function makeContext(options: {
  headers?: Headers;
  url?: string;
  routePath?: string;
}): ExecutionContext {
  const request = {
    headers: options.headers ?? {},
    method: 'GET',
    url: options.url ?? '/elevators?x=1',
    route: options.routePath === undefined ? undefined : { path: options.routePath },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function makeReflector(isPublic: boolean): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

describe('AppCheckGuard', () => {
  type Verify = AppCheckVerifier['verify'];
  let verify: jest.MockedFunction<Verify>;
  let verifier: AppCheckVerifier;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  const build = (mode: AppCheckMode, isPublic = false) =>
    new AppCheckGuard(makeReflector(isPublic), mode, verifier);

  const lastLog = (spy: jest.SpyInstance): Record<string, unknown> => {
    const calls = spy.mock.calls as unknown[][];
    return calls[calls.length - 1][0] as Record<string, unknown>;
  };

  beforeEach(() => {
    verify = jest.fn<ReturnType<Verify>, Parameters<Verify>>();
    verifier = { verify };
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('should skip public routes without touching the verifier', async () => {
    const allowed = await build('enforce', true).canActivate(
      makeContext({ headers: {} }),
    );
    expect(allowed).toBe(true);
    expect(verify).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should allow and not verify in off mode', async () => {
    const allowed = await build('off').canActivate(
      makeContext({ headers: { 'x-firebase-appcheck': 'tok' } }),
    );
    expect(allowed).toBe(true);
    expect(verify).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should allow a missing token in monitor and log missing', async () => {
    const allowed = await build('monitor').canActivate(
      makeContext({
        headers: { 'x-app-platform': 'android', 'x-app-build': '42' },
        routePath: '/elevators',
      }),
    );
    expect(allowed).toBe(true);
    expect(verify).not.toHaveBeenCalled();
    expect(lastLog(logSpy)).toMatchObject({
      event: 'app_check',
      outcome: 'missing',
      mode: 'monitor',
      route: 'GET /elevators',
      platform: 'android',
      build: '42',
      appId: null,
      reason: null,
    });
  });

  it('should allow an invalid token in monitor and warn invalid', async () => {
    verify.mockRejectedValue({ code: 'app-check/invalid-argument' });
    const allowed = await build('monitor').canActivate(
      makeContext({ headers: { 'x-firebase-appcheck': 'bad' } }),
    );
    expect(allowed).toBe(true);
    expect(lastLog(warnSpy)).toMatchObject({
      outcome: 'invalid',
      reason: 'app-check/invalid-argument',
    });
  });

  it('should reject a missing token in enforce with 401 APP_CHECK_FAILED', async () => {
    const error: unknown = await build('enforce')
      .canActivate(makeContext({ headers: {} }))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toEqual({
      code: 'APP_CHECK_FAILED',
      // `expect.any` is typed `any`; the cast keeps the copy clean under the
      // backends' `no-unsafe-assignment`.
      message: expect.any(String) as unknown,
    });
    expect(lastLog(logSpy)).toMatchObject({ outcome: 'missing', mode: 'enforce' });
  });

  it('should reject an invalid token in enforce', async () => {
    verify.mockRejectedValue({ code: 'app-check/invalid-argument' });
    await expect(
      build('enforce').canActivate(
        makeContext({ headers: { 'x-firebase-appcheck': 'bad' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(lastLog(warnSpy)).toMatchObject({ outcome: 'invalid' });
  });

  it('should allow a verified token in enforce and log appId', async () => {
    verify.mockResolvedValue({ appId: '1:123:android:abc' });
    const allowed = await build('enforce').canActivate(
      makeContext({ headers: { 'x-firebase-appcheck': 'good' } }),
    );
    expect(allowed).toBe(true);
    expect(verify).toHaveBeenCalledWith('good');
    expect(lastLog(logSpy)).toMatchObject({
      outcome: 'verified',
      appId: '1:123:android:abc',
    });
  });

  it('should allow and log error when verification fails for a non-token reason in enforce', async () => {
    verify.mockRejectedValue({ code: 'app/no-app', message: 'not initialised' });
    const allowed = await build('enforce').canActivate(
      makeContext({ headers: { 'x-firebase-appcheck': 'tok' } }),
    );
    expect(allowed).toBe(true);
    expect(lastLog(warnSpy)).toMatchObject({
      outcome: 'error',
      reason: 'app/no-app',
    });
  });

  it('should log error with the error name when the failure has no code', async () => {
    verify.mockRejectedValue(new TypeError('fetch failed'));
    const allowed = await build('enforce').canActivate(
      makeContext({ headers: { 'x-firebase-appcheck': 'tok' } }),
    );
    expect(allowed).toBe(true);
    expect(lastLog(warnSpy)).toMatchObject({ outcome: 'error', reason: 'TypeError' });
  });

  it('should strip the query string from the route when there is no route path', async () => {
    await build('monitor').canActivate(
      makeContext({ headers: {}, url: '/users/me?x=1&y=2' }),
    );
    expect(lastLog(logSpy)).toMatchObject({ route: 'GET /users/me' });
  });

  it('should never put the token into the log', async () => {
    verify.mockResolvedValue({ appId: 'app' });
    await build('monitor').canActivate(
      makeContext({ headers: { 'x-firebase-appcheck': 'secret-token' } }),
    );
    expect(JSON.stringify(lastLog(logSpy))).not.toContain('secret-token');
  });
});
