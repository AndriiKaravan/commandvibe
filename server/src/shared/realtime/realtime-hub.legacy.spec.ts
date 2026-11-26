// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { NOW_MS, flush, makeHub } from './hub-test-kit';
import { RealtimeOptions } from './options';

const legacy: RealtimeOptions['legacy'] = {
  queryTokenParam: 'token',
  encode: (e) => ({ type: e.type, profileId: e.topic.slice('profile:'.length), payload: e.data }),
};

describe('RealtimeHub legacy sessions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
  });
  afterEach(() => jest.useRealTimers());

  it('should never send a v1 frame to a legacy session', async () => {
    let assigned = ['profile:p1'];
    const { hub, connectLegacy } = makeHub({
      legacy,
      initialTopics: async () => assigned,
      authorizeSubscribe: async () => true,
    });
    const { socket, send } = await connectLegacy('u1');
    send('{"t":"sub","id":1,"topics":["group:a"]}');
    send('{"t":"ping"}');
    send('{"t":"auth","id":2,"token":"u1"}');
    assigned = ['profile:p2'];
    hub.refreshTopics('u1');
    await flush();
    hub.publish('group:a', 'x', {});
    hub.publish('profile:p2', 'y', { n: 1 });
    await flush();
    expect(socket.sent.some((frame) => 't' in frame)).toBe(false);
    expect(socket.sent.map((f) => f.type)).toEqual(['ready', 'error', 'error', 'error', 'y']);
  });

  it('should keep the URL token out of every log line', async () => {
    const { connectLegacy, logger, hub } = makeHub({
      legacy,
      verifyToken: async (token) => {
        if (token === 'secret-bad-token-123') throw new Error('rejected');
        return { userId: 'u1' };
      },
    });
    await connectLegacy('secret-good-token-456');
    await connectLegacy('secret-bad-token-123');
    hub.disconnectUser('u1');
    await flush();
    const logged = JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls, logger.error.mock.calls]);
    expect(logged).not.toMatch(/secret-(good|bad)-token/);
  });

  it('should still deliver to v1 sessions and log when the legacy encoder throws', async () => {
    const { hub, connectLegacy, connectReady, logger } = makeHub({
      legacy: { queryTokenParam: 'token', encode: () => { throw new Error('bad encoder'); } },
      initialTopics: async () => ['profile:p1'],
    });
    const old = await connectLegacy('u1');
    const v1 = await connectReady('u2');
    hub.publish('profile:p1', 'x', {});
    expect(v1.socket.framesOf('event')).toHaveLength(1);
    expect(old.socket.sent).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith('realtime.legacy_encode_failed', expect.anything());
  });

  it('should encode a publish once however many legacy sessions get it', async () => {
    const encode = jest.fn(legacy!.encode);
    const { hub, connectLegacy } = makeHub({
      legacy: { queryTokenParam: 'token', encode },
      initialTopics: async () => ['profile:p1'],
    });
    await connectLegacy('u1');
    await connectLegacy('u2');
    await connectLegacy('u3');
    hub.publish('profile:p1', 'x', {});
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('should close a revoked legacy session with 4403', async () => {
    const { hub, connectLegacy } = makeHub({ legacy });
    const { socket } = await connectLegacy('u1');
    hub.disconnectUser('u1');
    expect(socket.closed?.code).toBe(4403);
  });

  it('should count legacy sessions against maxConnectionsPerUser', async () => {
    const { connectLegacy, connectReady } = makeHub({ legacy, limits: { maxConnectionsPerUser: 1 } });
    await connectLegacy('u1');
    const v1 = await connectReady('u1');
    expect(v1.socket.closed?.code).toBe(4429);
  });

  it('should not run the idle timeout on legacy sessions, which never send frames', async () => {
    const { connectLegacy } = makeHub({ legacy });
    const { socket, handle } = await connectLegacy('u1');
    for (let i = 0; i < 6; i++) {
      await jest.advanceTimersByTimeAsync(30_000);
      handle.onPong?.();
    }
    expect(socket.pings).toBe(6);
    expect(socket.closed).toBeUndefined();
  });

  it('should rotate legacy sessions at 50–55 min with 1012 like v1', async () => {
    const { connectLegacy } = makeHub({ legacy }, { random: () => 0 });
    const { socket, handle } = await connectLegacy('u1');
    for (let i = 0; i < 100 && !socket.closed; i++) {
      await jest.advanceTimersByTimeAsync(30_000);
      handle.onPong?.();
    }
    expect(socket.closed?.code).toBe(1012);
  });

  it('should send nothing to legacy sessions and encode once when encode returns undefined', async () => {
    const encode = jest.fn(() => undefined);
    const { hub, connectLegacy, connectReady, logger } = makeHub({
      legacy: { queryTokenParam: 'token', encode },
      initialTopics: async () => ['profile:p1'],
    });
    const a = await connectLegacy('u1');
    const b = await connectLegacy('u2');
    const v1 = await connectReady('u3');
    hub.publish('profile:p1', 'new.only', {});
    expect(encode).toHaveBeenCalledTimes(1);
    expect([a.socket.sent.length, b.socket.sent.length]).toEqual([1, 1]);
    expect(v1.socket.framesOf('event')).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should mark legacy sessions in the connect log', async () => {
    const { connectLegacy, logger } = makeHub({ legacy });
    await connectLegacy('u1');
    expect(logger.info).toHaveBeenCalledWith('realtime.connected', expect.objectContaining({ legacy: true }));
  });
});
