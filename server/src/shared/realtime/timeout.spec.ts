// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { CALLBACK_TIMEOUT_MS, callWithTimeout } from './timeout';

describe('callWithTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('should not keep the process alive while a callback hangs', () => {
    const created: { hasRef(): boolean }[] = [];
    const real = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation(((...args: Parameters<typeof setTimeout>) => {
      const timer = real(...args) as unknown as { hasRef(): boolean };
      created.push(timer);
      return timer;
    }) as typeof setTimeout);
    void callWithTimeout(() => new Promise(() => {}), 'hung').catch(() => undefined);
    expect(created).toHaveLength(1);
    expect(created[0].hasRef()).toBe(false);
  });

  it('should still reject after the timeout', async () => {
    const pending = callWithTimeout(() => new Promise(() => {}), 'hung');
    const settled = expect(pending).rejects.toThrow(/hung timed out/);
    await jest.advanceTimersByTimeAsync(CALLBACK_TIMEOUT_MS);
    await settled;
  });
});
