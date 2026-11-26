// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { NOW_MS, flush, makeHub } from './hub-test-kit';
import { FakeSocket } from './testing';

describe('RealtimeHub subscription limit and shutdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
  });
  afterEach(() => jest.useRealTimers());

  it('should not let sub of assigned topics push the recorded subscriptions past maxTopicsPerSession', async () => {
    let assigned = ['profile:a', 'profile:b', 'profile:c'];
    const { hub, connectReady } = makeHub({
      initialTopics: async () => assigned,
      authorizeSubscribe: async () => true,
      limits: { maxTopicsPerSession: 1 },
    });
    const { socket, send } = await connectReady();
    send({ t: 'sub', id: 1, topics: ['profile:a', 'profile:b', 'profile:c'] });
    await flush();
    expect(socket.sent.at(-1)).toEqual({ t: 'ack', id: 1, ok: ['profile:a', 'profile:b', 'profile:c'] });
    assigned = [];
    hub.refreshTopics('u1');
    await flush();
    // Only one of the three was recorded as a client subscription, so only it survives.
    const topics = socket.framesOf('topics').at(-1) as { remove: string[] };
    expect(topics.remove).toHaveLength(2);
  });

  it('should terminate sockets that were closed before shutdown but never confirmed', async () => {
    const { hub, connectReady } = makeHub({ initialTopics: async () => ['profile:p1'] });
    const slow = await connectReady('u1');
    slow.socket.bufferedAmount = 2_000_000;
    hub.publish('profile:p1', 'x', {});
    expect(slow.socket.closed?.code).toBe(1013);
    const done = hub.shutdown();
    await jest.advanceTimersByTimeAsync(2_000);
    await done;
    expect(slow.socket.terminated).toBe(true);
  });

  it('should terminate sockets accepted during the shutdown grace period', async () => {
    const { hub, connectReady } = makeHub();
    await connectReady('u1');
    const done = hub.shutdown();
    const late = new FakeSocket();
    hub.accept(late, {});
    expect(late.closed?.code).toBe(1012);
    await jest.advanceTimersByTimeAsync(2_000);
    await done;
    expect(late.terminated).toBe(true);
  });

  it('should not terminate sockets the transport confirmed closed', async () => {
    const { hub, connectReady } = makeHub();
    const a = await connectReady('u1');
    const done = hub.shutdown();
    a.handle.onClose(1012);
    await done;
    expect(a.socket.terminated).toBe(false);
  });

  it('should not wait for or terminate a socket the transport already confirmed closed', async () => {
    const { hub, connectReady } = makeHub();
    const gone = await connectReady('u1');
    gone.handle.onClose(1006);
    let finished = false;
    void hub.shutdown().then(() => (finished = true));
    await jest.advanceTimersByTimeAsync(0);
    expect(finished).toBe(true);
    expect(gone.socket.terminated).toBe(false);
  });

  it('should make a second shutdown call wait for the first to finish', async () => {
    const { hub, connectReady, options } = makeHub();
    const closeAdapter = jest.spyOn(options.adapter, 'close');
    const stuck = await connectReady('u1');
    const first = hub.shutdown();
    let secondDone = false;
    void hub.shutdown().then(() => (secondDone = true));
    await jest.advanceTimersByTimeAsync(1_999);
    expect(secondDone).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await first;
    expect(secondDone).toBe(true);
    expect(stuck.socket.terminated).toBe(true);
    expect(closeAdapter).toHaveBeenCalledTimes(1);
  });
});
