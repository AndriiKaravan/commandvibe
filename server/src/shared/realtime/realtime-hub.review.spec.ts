// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { CloseCode } from './protocol';
import { NOW_MS, flush, makeHub } from './hub-test-kit';

/** A promise the test resolves by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('RealtimeHub review fixes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
  });
  afterEach(() => jest.useRealTimers());

  it('should enforce maxConnectionsPerUser for concurrent hellos', async () => {
    const gate = deferred<void>();
    const { connect } = makeHub({
      verifyToken: async () => {
        await gate.promise;
        return { userId: 'u1' };
      },
    });
    const clients = Array.from({ length: 15 }, () => connect());
    for (const c of clients) c.send({ t: 'hello', v: 1, token: 'x' });
    gate.resolve();
    await flush();
    const ready = clients.filter((c) => c.socket.framesOf('ready').length > 0);
    const rejected = clients.filter((c) => c.socket.closed?.code === CloseCode.TooMany);
    expect([ready.length, rejected.length]).toEqual([10, 5]);
  });

  it('should apply a refreshTopics issued while initialTopics is in flight', async () => {
    let access = ['profile:p1', 'profile:p9'];
    const first = deferred<void>();
    let calls = 0;
    const { hub, connect } = makeHub({
      initialTopics: async () => {
        const snapshot = access;
        if (calls++ === 0) await first.promise;
        return snapshot;
      },
    });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'u1' });
    await flush();
    access = ['profile:p1'];
    hub.refreshTopics('u1');
    first.resolve();
    await flush();
    hub.publish('profile:p9', 'x', {});
    expect(socket.framesOf('event')).toEqual([]);
    expect(socket.framesOf('ready')[0]).toMatchObject({ topics: ['profile:p1'] });
  });

  it('should close with 4403 a session revoked while initialTopics is in flight', async () => {
    const gate = deferred<void>();
    const { hub, connect } = makeHub({
      initialTopics: async () => {
        await gate.promise;
        return [];
      },
    });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'u1' });
    await flush();
    hub.disconnectUser('u1');
    gate.resolve();
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.Forbidden);
    expect(socket.framesOf('ready')).toEqual([]);
  });

  it('should deny limit before calling authorizeSubscribe', async () => {
    const authorizeSubscribe = jest.fn(async () => true);
    const { connectReady } = makeHub({ authorizeSubscribe, limits: { maxTopicsPerSession: 2 } });
    const { socket, send } = await connectReady();
    send({ t: 'sub', id: 1, topics: Array.from({ length: 100 }, (_, i) => `group:${i}`) });
    await flush();
    expect(authorizeSubscribe).toHaveBeenCalledTimes(2);
    expect(socket.sent.at(-1)).toMatchObject({ ok: ['group:0', 'group:1'] });
  });

  it('should close 4429 when more than 64 frames wait behind a pending sub', async () => {
    const { connectReady } = makeHub({ authorizeSubscribe: () => new Promise(() => {}) });
    const { socket, send } = await connectReady();
    for (let i = 0; i < 64; i++) send({ t: 'unsub', id: i, topics: ['group:a'] });
    expect(socket.closed).toBeUndefined();
    send({ t: 'sub', id: 99, topics: ['group:b'] });
    expect(socket.closed?.code).toBe(CloseCode.TooMany);
  });

  it('should close 4401 when verifyToken does not answer within 10 s', async () => {
    const { connect } = makeHub({ verifyToken: () => new Promise(() => {}) });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'x' });
    await jest.advanceTimersByTimeAsync(9_999);
    expect(socket.closed).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    expect(socket.closed?.code).toBe(CloseCode.Unauthorized);
  });

  it('should not let frames before ready keep a hanging handshake alive', async () => {
    const { connect } = makeHub({ verifyToken: () => new Promise(() => {}) });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'x' });
    for (let i = 0; i < 6; i++) {
      await jest.advanceTimersByTimeAsync(5_000);
      send({ t: 'future' });
    }
    expect(socket.closed).toBeDefined();
  });

  it('should close 4400 when the first frame has an unknown type', async () => {
    const { connect } = makeHub();
    const { socket, send } = connect();
    send({ t: 'future' });
    expect(socket.closed?.code).toBe(CloseCode.BadFrame);
  });

  it('should deny forbidden when authorizeSubscribe does not answer within 10 s and keep serving', async () => {
    let hang = true;
    const { connectReady } = makeHub({
      authorizeSubscribe: () => (hang ? new Promise(() => {}) : Promise.resolve(true)),
    });
    const { socket, send } = await connectReady();
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    await jest.advanceTimersByTimeAsync(10_000);
    expect(socket.sent.at(-1)).toMatchObject({ id: 1, denied: [{ topic: 'group:a', reason: 'forbidden' }] });
    hang = false;
    send({ t: 'sub', id: 2, topics: ['group:b'] });
    await flush();
    expect(socket.sent.at(-1)).toMatchObject({ id: 2, ok: ['group:b'] });
  });

  it('should close 1013 when initialTopics fails at hello so the client retries', async () => {
    const { connect, logger } = makeHub({
      initialTopics: async () => {
        throw new Error('firestore down');
      },
    });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'u1' });
    await flush();
    expect(socket.framesOf('ready')).toEqual([]);
    expect(socket.closed?.code).toBe(CloseCode.TryAgainLater);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should close 1013 when initialTopics does not answer within 10 s', async () => {
    const { connect } = makeHub({ initialTopics: () => new Promise(() => {}) });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'u1' });
    await jest.advanceTimersByTimeAsync(10_000);
    expect(socket.closed?.code).toBe(CloseCode.TryAgainLater);
  });

  it('should close 1013 when initialTopics fails during refresh so a revoked topic cannot linger', async () => {
    let fail = false;
    const { hub, connectReady } = makeHub({
      initialTopics: async () => {
        if (fail) throw new Error('firestore down');
        return ['profile:secret'];
      },
    });
    const { socket } = await connectReady();
    fail = true;
    hub.refreshTopics('u1');
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.TryAgainLater);
    hub.publish('profile:secret', 'x', {});
    expect(socket.framesOf('event')).toEqual([]);
  });

  it('should close 4403 a session revoked while its verifyToken was in flight', async () => {
    const gate = deferred<void>();
    const { hub, connect } = makeHub({
      verifyToken: async () => {
        await gate.promise;
        return { userId: 'u1' };
      },
    });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'x' });
    await flush();
    hub.disconnectUser('u1');
    gate.resolve();
    await flush();
    expect(socket.framesOf('ready')).toEqual([]);
    expect(socket.closed?.code).toBe(CloseCode.Forbidden);
  });

  it('should accept a connection that starts after the revocation', async () => {
    const { hub, connectReady } = makeHub();
    hub.disconnectUser('u1');
    await jest.advanceTimersByTimeAsync(1);
    const { socket } = await connectReady('u1');
    expect(socket.framesOf('ready')).toHaveLength(1);
  });

  it('should close 1013 when refreshTopics keeps the handshake re-reading initialTopics', async () => {
    const { hub, connect } = makeHub({
      initialTopics: () => new Promise((resolve) => setTimeout(() => resolve([]), 1_000)),
    });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'u1' });
    for (let i = 0; i < 20 && !socket.closed; i++) {
      await jest.advanceTimersByTimeAsync(500);
      hub.refreshTopics('u1');
    }
    expect(socket.closed?.code).toBe(CloseCode.TryAgainLater);
    expect(hub.stats().connections).toBe(0);
  });

  it('should release pending slots so more than 64 sub frames over time are fine', async () => {
    const { connectReady } = makeHub({ authorizeSubscribe: async () => true, limits: { maxTopicsPerSession: 500 } });
    const { socket, send } = await connectReady();
    for (let batch = 0; batch < 3; batch++) {
      for (let i = 0; i < 40; i++) send({ t: 'sub', id: batch * 40 + i, topics: [`group:${batch}-${i}`] });
      await flush();
    }
    expect(socket.closed).toBeUndefined();
    expect(socket.framesOf('ack')).toHaveLength(120);
  });

  it('should close 1011 instead of an unhandled rejection when the handshake throws unexpectedly', async () => {
    const { connect } = makeHub();
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    const { socket, send } = connect();
    jest.spyOn(socket, 'send').mockImplementationOnce(() => {
      throw new Error('socket broken');
    });
    send({ t: 'hello', v: 1, token: 'u1' });
    await flush();
    await new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(socket.closed?.code).toBe(1011);
  });

  it('should not let a throwing logger break the connection', async () => {
    const { connectReady, logger } = makeHub();
    logger.info.mockImplementation(() => {
      throw new Error('logger broken');
    });
    const { socket } = await connectReady();
    expect(socket.framesOf('ready')).toHaveLength(1);
    expect(socket.closed).toBeUndefined();
  });

  it('should send data null when publish gets undefined data', async () => {
    const { hub, connectReady } = makeHub({ initialTopics: async () => ['profile:p1'] });
    const { socket } = await connectReady();
    hub.publish('profile:p1', 'x', undefined);
    expect(socket.framesOf('event')[0]).toHaveProperty('data', null);
  });

  it('should close 4400 and unregister at once on a binary frame', async () => {
    const { hub, connectReady } = makeHub();
    const { socket, handle } = await connectReady();
    handle.onMessage('{"t":"ping"}', true);
    expect(socket.closed?.code).toBe(CloseCode.BadFrame);
    expect(hub.stats().connections).toBe(0);
  });

  it('should leave no timer behind when sending ready closes a slow consumer', async () => {
    const { connect } = makeHub();
    const { socket, send } = connect();
    socket.bufferedAmount = 2_000_000;
    send({ t: 'hello', v: 1, token: 'u1' });
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.TryAgainLater);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should keep delivering to other sessions and log when one send throws', async () => {
    const { hub, connectReady, logger } = makeHub({ initialTopics: async () => ['profile:p1'] });
    const broken = await connectReady('u1');
    const healthy = await connectReady('u2');
    jest.spyOn(broken.socket, 'send').mockImplementation(() => {
      throw new Error('socket broken');
    });
    hub.publish('profile:p1', 'x', {});
    expect(healthy.socket.framesOf('event')).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith('realtime.send_failed', expect.anything());
  });

  it('should truncate client app and platform in logs', async () => {
    const { connect, logger } = makeHub();
    const { send } = connect();
    send({ t: 'hello', v: 1, token: 'u1', client: { app: 'a'.repeat(5000), platform: 'p'.repeat(5000) } });
    await flush();
    const connected = logger.info.mock.calls.find(([message]) => message === 'realtime.connected');
    expect(connected?.[1]).toMatchObject({ app: 'a'.repeat(64), platform: 'p'.repeat(64) });
  });
});
