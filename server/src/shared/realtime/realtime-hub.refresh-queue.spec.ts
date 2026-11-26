// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { NOW_MS, flush, makeHub } from './hub-test-kit';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('RealtimeHub refreshTopics queue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
  });
  afterEach(() => jest.useRealTimers());

  it('should coalesce many refreshTopics calls behind a pending sub into one read', async () => {
    const gate = deferred<boolean>();
    const initialTopics = jest.fn(async () => ['profile:p1']);
    const { hub, connectReady } = makeHub({ initialTopics, authorizeSubscribe: () => gate.promise });
    const { send } = await connectReady();
    initialTopics.mockClear();
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    await flush();
    for (let i = 0; i < 5_000; i++) hub.refreshTopics('u1');
    gate.resolve(true);
    await flush();
    expect(initialTopics).toHaveBeenCalledTimes(1);
  });

  it('should run a refresh before client frames that were queued earlier', async () => {
    const order: string[] = [];
    const firstSub = deferred<boolean>();
    let access = ['profile:p1', 'profile:secret'];
    const { hub, connectReady } = makeHub({
      initialTopics: async () => {
        order.push('refresh');
        return access;
      },
      authorizeSubscribe: async (_s, topic) => {
        order.push(`sub ${topic}`);
        return topic === 'group:a' ? firstSub.promise : true;
      },
    });
    const { send } = await connectReady();
    order.length = 0;
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    send({ t: 'sub', id: 2, topics: ['group:b'] });
    send({ t: 'sub', id: 3, topics: ['group:c'] });
    await flush();
    access = ['profile:p1'];
    hub.refreshTopics('u1');
    firstSub.resolve(true);
    await flush();
    // The second 'sub group:a' is the refresh re-authorizing the subscription it just made.
    expect(order).toEqual(['sub group:a', 'refresh', 'sub group:a', 'sub group:b', 'sub group:c']);
  });

  it('should revoke a topic after at most the running task, not after 64 queued ones', async () => {
    const hang = deferred<boolean>();
    let access = ['profile:secret'];
    const { hub, connectReady } = makeHub({
      initialTopics: async () => access,
      authorizeSubscribe: () => hang.promise,
    });
    const { socket, send } = await connectReady();
    for (let i = 0; i < 40; i++) send({ t: 'sub', id: i, topics: [`group:${i}`] });
    await flush();
    access = [];
    hub.refreshTopics('u1');
    await jest.advanceTimersByTimeAsync(10_000);
    hub.publish('profile:secret', 'x', {});
    expect(socket.framesOf('event')).toEqual([]);
    expect(socket.framesOf('topics')).toEqual([{ t: 'topics', add: [], remove: ['profile:secret'] }]);
  });

  it('should not lose a refresh requested while another refresh is running', async () => {
    const firstRead = deferred<string[]>();
    let reads = 0;
    const { hub, connectReady } = makeHub({
      initialTopics: () => (reads++ === 0 ? Promise.resolve(['profile:p1']) : reads === 2 ? firstRead.promise : Promise.resolve(['profile:p2'])),
    });
    const { socket } = await connectReady();
    hub.refreshTopics('u1');
    await flush();
    hub.refreshTopics('u1');
    firstRead.resolve(['profile:p1']);
    await flush();
    expect(reads).toBe(3);
    hub.publish('profile:p2', 'x', {});
    expect(socket.framesOf('event')).toHaveLength(1);
  });

  it('should re-read topics after auth changes the claims, even when a refresh jumped ahead of the auth', async () => {
    const gate = deferred<boolean>();
    const { hub, connectReady } = makeHub({
      verifyToken: async (token) => {
        const [userId, role] = token.split(':');
        return { userId, claims: { role } };
      },
      initialTopics: async (session) => (session.claims.role === 'admin' ? ['profile:admin'] : ['profile:p1']),
      authorizeSubscribe: () => gate.promise,
    });
    const { socket, send } = await connectReady('u1:admin');
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    await flush();
    send({ t: 'auth', id: 2, token: 'u1:member' });
    hub.refreshTopics('u1');
    gate.resolve(true);
    await flush();
    hub.publish('profile:admin', 'x', {});
    hub.publish('profile:p1', 'y', {});
    expect(socket.framesOf('event').map((e) => e.type)).toEqual(['y']);
  });

  it('should not re-read topics when auth leaves the claims unchanged', async () => {
    const initialTopics = jest.fn(async () => ['profile:p1']);
    const { connectReady } = makeHub({
      verifyToken: async (token) => ({ userId: token, claims: { role: 'member' } }),
      initialTopics,
    });
    const { send } = await connectReady('u1');
    initialTopics.mockClear();
    send({ t: 'auth', id: 1, token: 'u1' });
    await flush();
    expect(initialTopics).not.toHaveBeenCalled();
  });

  it('should still serve client frames while refreshTopics is called faster than a refresh takes', async () => {
    let reads = 0;
    const { hub, connectReady } = makeHub({
      // Instant for the handshake, 5 ms for every refresh after it.
      initialTopics: () =>
        reads++ === 0 ? Promise.resolve(['profile:p1']) : new Promise((resolve) => setTimeout(() => resolve(['profile:p1']), 5)),
      authorizeSubscribe: async () => true,
    });
    const { socket, send } = await connectReady();
    send({ t: 'sub', id: 0, topics: ['group:warmup'] });
    await flush();
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    // A refresh running makes the new sub wait in the queue behind it.
    hub.refreshTopics('u1');
    await flush();
    send({ t: 'sub', id: 2, topics: ['group:b'] });
    for (let i = 0; i < 200 && socket.framesOf('ack').length < 3; i++) {
      hub.refreshTopics('u1');
      await jest.advanceTimersByTimeAsync(2);
    }
    expect(socket.framesOf('ack').map((a) => a.id)).toEqual([0, 1, 2]);
  });

  it('should not run queued client frames after the connection closed', async () => {
    const gate = deferred<boolean>();
    const authorizeSubscribe = jest.fn(() => gate.promise);
    const { connectReady } = makeHub({ authorizeSubscribe });
    const { handle, send } = await connectReady();
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    send({ t: 'sub', id: 2, topics: ['group:b'] });
    send({ t: 'sub', id: 3, topics: ['group:c'] });
    await flush();
    handle.onClose(1006);
    gate.resolve(true);
    await flush();
    expect(authorizeSubscribe).toHaveBeenCalledTimes(1);
  });

  it('should not put a closed connection back into the index when a refresh resolves late', async () => {
    const gate = deferred<string[]>();
    let reads = 0;
    const { hub, connectReady } = makeHub({
      initialTopics: () => (reads++ === 0 ? Promise.resolve(['profile:p1']) : gate.promise),
    });
    const { handle } = await connectReady();
    hub.refreshTopics('u1');
    await flush();
    handle.onClose(1006);
    gate.resolve(['profile:p1', 'profile:new']);
    await flush();
    expect(hub.stats()).toEqual({ connections: 0, topics: 0 });
  });

  it('should run the refresh queued by an auth before client frames sent after that auth', async () => {
    const order: string[] = [];
    const gate = deferred<boolean>();
    const { connectReady } = makeHub({
      verifyToken: async (token) => {
        const [userId, role] = token.split(':');
        return { userId, claims: { role } };
      },
      initialTopics: async (session) => {
        order.push(`refresh ${String(session.claims.role)}`);
        return session.claims.role === 'admin' ? ['profile:admin'] : ['profile:p1'];
      },
      authorizeSubscribe: async (_s, topic) => {
        order.push(`sub ${topic}`);
        return topic === 'group:a' ? gate.promise : true;
      },
    });
    const { send } = await connectReady('u1:admin');
    order.length = 0;
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    send({ t: 'auth', id: 2, token: 'u1:member' });
    send({ t: 'sub', id: 3, topics: ['group:b'] });
    await flush();
    gate.resolve(true);
    await flush();
    // The second 'sub group:a' is the refresh re-authorizing the subscription made first.
    expect(order).toEqual(['sub group:a', 'refresh member', 'sub group:a', 'sub group:b']);
  });

  it('should keep the queue, the refresh flag and the pending counter healthy after a task throws', async () => {
    const initialTopics = jest.fn(async () => ['profile:p1']);
    const { hub, connectReady, logger } = makeHub({ authorizeSubscribe: async () => true, initialTopics });
    const { socket, send } = await connectReady();
    jest.spyOn(socket, 'send').mockImplementationOnce(() => {
      throw new Error('socket broken');
    });
    send({ t: 'sub', id: 1, topics: ['group:a'] });
    await flush();
    expect(logger.error).toHaveBeenCalledWith('realtime.frame_failed', expect.anything());
    initialTopics.mockClear();
    hub.refreshTopics('u1');
    await flush();
    expect(initialTopics).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 70; i++) {
      send({ t: 'sub', id: 10 + i, topics: [`group:x${i}`] });
      await flush();
    }
    expect(socket.closed).toBeUndefined();
    expect(socket.framesOf('ack').at(-1)).toMatchObject({ id: 79 });
  });

  it('should still ack an auth whose claims cannot be serialized and re-read topics', async () => {
    const initialTopics = jest.fn(async () => ['profile:p1']);
    const { connectReady } = makeHub({
      verifyToken: async (token) => ({ userId: 'u1', claims: token === 'big' ? { n: 10n } : { n: 1 } }),
      initialTopics,
    });
    const { socket, send } = await connectReady('small');
    initialTopics.mockClear();
    send({ t: 'auth', id: 5, token: 'big' });
    await flush();
    expect(socket.framesOf('ack')).toEqual([{ t: 'ack', id: 5 }]);
    expect(initialTopics).toHaveBeenCalledTimes(1);
  });
});
