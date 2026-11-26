// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { DEFAULT_LIMITS, RealtimeOptions, resolveOptions } from './options';
import { InProcessBroadcastAdapter } from './broadcast-adapter';

const base: RealtimeOptions = {
  path: '/ws',
  verifyToken: async () => ({ userId: 'u1' }),
};

describe('resolveOptions', () => {
  it('should apply the default limits and an in-process adapter', () => {
    const resolved = resolveOptions(base);
    expect(resolved.limits).toEqual(DEFAULT_LIMITS);
    expect(DEFAULT_LIMITS).toEqual({
      maxConnectionsPerUser: 10,
      maxTopicsPerSession: 50,
      maxClientFrameBytes: 16_384,
      maxEventBytes: 65_536,
    });
    expect(resolved.adapter).toBeInstanceOf(InProcessBroadcastAdapter);
  });

  it('should merge partial limits over the defaults', () => {
    const resolved = resolveOptions({ ...base, limits: { maxTopicsPerSession: 5 } });
    expect(resolved.limits).toEqual({ ...DEFAULT_LIMITS, maxTopicsPerSession: 5 });
  });

  it('should throw when path does not start with a slash', () => {
    expect(() => resolveOptions({ ...base, path: 'ws' })).toThrow(/path/);
  });

  it('should throw on a legacy option without a token parameter or encoder', () => {
    expect(() => resolveOptions({ ...base, legacy: { queryTokenParam: '', encode: () => ({}) } })).toThrow(/legacy/);
  });

  it.each([-1, 1.5, NaN])('should throw when trustedProxyHops is %p', (hops) => {
    expect(() => resolveOptions({ ...base, trustedProxyHops: hops })).toThrow(/trustedProxyHops/);
  });

  it('should resolve trustedProxyHops to 1 unless set', () => {
    expect(resolveOptions(base).trustedProxyHops).toBe(1);
    expect(resolveOptions({ ...base, trustedProxyHops: 0 }).trustedProxyHops).toBe(0);
  });
});
