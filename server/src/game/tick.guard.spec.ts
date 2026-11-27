import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { OidcVerifier, TickGuard } from './tick.guard';

const invoker = 'commandvibe-scheduler@commandvibe-ks.iam.gserviceaccount.com';
const audience = 'https://api.test';

function contextWith(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: authorization ? { authorization } : {} }) }),
  } as unknown as ExecutionContext;
}

describe('TickGuard', () => {
  const seen: { token: string; audience: string }[] = [];
  const verifier: OidcVerifier = {
    async verify(token, forAudience) {
      seen.push({ token, audience: forAudience });
      if (token === 'good') return { email: invoker, emailVerified: true };
      if (token === 'stranger') return { email: 'someone@else.test', emailVerified: true };
      if (token === 'unverified') return { email: invoker, emailVerified: false };
      throw new Error('bad token');
    },
  };
  const guard = (config = { audience, invoker }) => new TickGuard(config, verifier);

  beforeEach(() => {
    seen.length = 0;
  });

  it('should look like a missing route while the tick is not configured', async () => {
    await expect(guard({} as never).canActivate(contextWith('Bearer good'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      guard({ audience, invoker: undefined } as never).canActivate(contextWith('Bearer good')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should refuse a request without a bearer token', async () => {
    await expect(guard().canActivate(contextWith())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard().canActivate(contextWith('Basic abc'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should refuse a token that does not verify, a stranger and an unverified email', async () => {
    for (const token of ['garbage', 'stranger', 'unverified']) {
      await expect(guard().canActivate(contextWith(`Bearer ${token}`))).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('should accept the scheduler identity and verify the token for our audience', async () => {
    await expect(guard().canActivate(contextWith('Bearer good'))).resolves.toBe(true);
    expect(seen).toEqual([{ token: 'good', audience }]);
  });
});
