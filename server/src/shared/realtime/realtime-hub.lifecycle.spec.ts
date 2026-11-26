// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { CloseCode } from './protocol';
import { NOW_MS, NOW_S, flush, makeHub } from './hub-test-kit';

const MIN = 60_000;

describe('RealtimeHub lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
  });
  afterEach(() => jest.useRealTimers());

  it('should send ready with sid, hb, exp and initial topics after a valid hello', async () => {
    const initialTopics = jest.fn(async () => ['profile:p1']);
    const { connect } = makeHub({ initialTopics });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: `u1@${NOW_S + 3600}`, client: { app: 'medvibe', build: 45 } });
    await flush();
    expect(socket.sent).toEqual([
      { t: 'ready', v: 1, sid: 's_id1', hb: 25_000, exp: NOW_S + 3600, topics: ['profile:p1'] },
    ]);
    expect(initialTopics).toHaveBeenCalledWith({
      sid: 's_id1', userId: 'u1', claims: {}, client: { app: 'medvibe', build: 45 },
    });
  });

  it('should close 4400 when no hello arrives within 10 s', async () => {
    const { connect } = makeHub();
    const { socket } = connect();
    await jest.advanceTimersByTimeAsync(9_999);
    expect(socket.closed).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    expect(socket.closed?.code).toBe(CloseCode.BadFrame);
  });

  it('should close 4400 when the first frame is not hello', async () => {
    const { connect } = makeHub();
    const { socket, send } = connect();
    send({ t: 'ping' });
    expect(socket.closed?.code).toBe(CloseCode.BadFrame);
  });

  it('should close 4400 on a second hello', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady();
    send({ t: 'hello', v: 1, token: 'u1' });
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.BadFrame);
  });

  it('should close 4400 on a frame larger than maxClientFrameBytes', async () => {
    const { connectReady } = makeHub({ limits: { maxClientFrameBytes: 100 } });
    const { socket, handle } = await connectReady();
    handle.onMessage(JSON.stringify({ t: 'ping', pad: 'x'.repeat(100) }));
    expect(socket.closed?.code).toBe(CloseCode.BadFrame);
  });

  it('should close 4400 on undecodable input after ready', async () => {
    const { connectReady } = makeHub();
    const { socket, handle } = await connectReady();
    handle.onMessage('not json');
    expect(socket.closed?.code).toBe(CloseCode.BadFrame);
  });

  it('should ignore an unknown frame type after ready', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady();
    send({ t: 'future' });
    await flush();
    expect(socket.closed).toBeUndefined();
  });

  it('should close 4426 for hello with v 2', async () => {
    const { connect } = makeHub();
    const { socket, send } = connect();
    send({ t: 'hello', v: 2, token: 'u1' });
    expect(socket.closed?.code).toBe(CloseCode.UnsupportedVersion);
  });

  it('should close 4401 without ready when verifyToken throws', async () => {
    const { connect } = makeHub();
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'bad' });
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.Unauthorized);
    expect(socket.sent).toEqual([]);
  });

  it('should close 4401 at once when the token is already expired', async () => {
    const { connect } = makeHub();
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: `u1@${NOW_S}` });
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.Unauthorized);
    expect(socket.sent).toEqual([]);
  });

  it('should process frames sent during verifyToken after ready, in order', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { connect } = makeHub({
      verifyToken: async () => {
        await gate;
        return { userId: 'u1' };
      },
    });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'x' });
    send({ t: 'ping' });
    send({ t: 'ping' });
    await flush();
    expect(socket.sent).toEqual([]);
    release();
    await flush();
    expect(socket.sent.map((f) => f.t)).toEqual(['ready', 'pong', 'pong']);
  });

  it('should close 4429 when more than 64 frames queue before ready', async () => {
    const { connect } = makeHub({ verifyToken: () => new Promise(() => {}) });
    const { socket, send } = connect();
    send({ t: 'hello', v: 1, token: 'x' });
    for (let i = 0; i < 64; i++) send({ t: 'ping' });
    expect(socket.closed).toBeUndefined();
    send({ t: 'ping' });
    expect(socket.closed?.code).toBe(CloseCode.TooMany);
  });

  it('should send nothing and register nothing when the socket closes before verifyToken resolves', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const initialTopics = jest.fn(async () => ['profile:p1']);
    const { hub, connect } = makeHub({
      verifyToken: async () => {
        await gate;
        return { userId: 'u1' };
      },
      initialTopics,
    });
    const { socket, send, handle } = connect();
    send({ t: 'hello', v: 1, token: 'x' });
    handle.onClose(1006);
    release();
    await flush();
    expect(socket.sent).toEqual([]);
    expect(initialTopics).not.toHaveBeenCalled();
    expect(hub.stats()).toEqual({ connections: 0, topics: 0 });
  });

  it('should drop invalid topics returned by initialTopics', async () => {
    const { connectReady, logger } = makeHub({
      initialTopics: async () => ['profile:p1', 'bad topic'],
    });
    const { socket } = await connectReady();
    expect(socket.sent[0]).toMatchObject({ topics: ['profile:p1'] });
    expect(logger.error).toHaveBeenCalled();
  });

  it('should answer ping with pong', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady();
    send({ t: 'ping' });
    expect(socket.sent.at(-1)).toEqual({ t: 'pong' });
  });

  it('should close 1001 after 60 s without any client frame', async () => {
    const { connectReady } = makeHub();
    const { socket } = await connectReady();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(socket.closed?.code).toBe(CloseCode.GoingAway);
  });

  it('should not close for idleness while pings keep arriving', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady();
    for (let i = 0; i < 5; i++) {
      await jest.advanceTimersByTimeAsync(25_000);
      send({ t: 'ping' });
    }
    expect(socket.closed).toBeUndefined();
  });

  it('should close 4401 at token expiry', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady(`u1@${NOW_S + 120}`);
    for (let i = 0; i < 4; i++) {
      await jest.advanceTimersByTimeAsync(29_999);
      send({ t: 'ping' });
    }
    expect(socket.closed).toBeUndefined();
    await jest.advanceTimersByTimeAsync(4);
    expect(socket.closed?.code).toBe(CloseCode.Unauthorized);
  });

  it('should extend expiry after auth and reply ack with the new exp', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady(`u1@${NOW_S + 60}`);
    send({ t: 'auth', id: 7, token: `u1@${NOW_S + 3600}` });
    await flush();
    expect(socket.sent.at(-1)).toEqual({ t: 'ack', id: 7, exp: NOW_S + 3600 });
    await jest.advanceTimersByTimeAsync(59_000);
    send({ t: 'ping' });
    await jest.advanceTimersByTimeAsync(2_000);
    expect(socket.closed).toBeUndefined();
  });

  it('should close 4401 on auth for a different user', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady('u1');
    send({ t: 'auth', id: 1, token: 'u2' });
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.Unauthorized);
  });

  it('should close 4401 when verifyToken throws on auth', async () => {
    const { connectReady } = makeHub();
    const { socket, send } = await connectReady('u1');
    send({ t: 'auth', id: 1, token: 'bad' });
    await flush();
    expect(socket.closed?.code).toBe(CloseCode.Unauthorized);
  });

  it('should close 1012 at 50 min of age when random is 0', async () => {
    const { connectReady } = makeHub({}, { random: () => 0 });
    const { socket, send } = await connectReady();
    for (let i = 0; i < 50 * 2; i++) {
      send({ t: 'ping' });
      await jest.advanceTimersByTimeAsync(MIN / 2 - (i === 99 ? 1 : 0));
    }
    expect(socket.closed).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    expect(socket.closed?.code).toBe(CloseCode.Restart);
  });

  it('should close 1012 just before 55 min of age when random approaches 1', async () => {
    const { connectReady } = makeHub({}, { random: () => 0.999999 });
    const { socket, send } = await connectReady();
    for (let i = 0; i < 109; i++) {
      send({ t: 'ping' });
      await jest.advanceTimersByTimeAsync(MIN / 2);
    }
    expect(socket.closed).toBeUndefined();
    send({ t: 'ping' });
    await jest.advanceTimersByTimeAsync(MIN / 2);
    expect(socket.closed?.code).toBe(CloseCode.Restart);
  });

  it('should close everyone 1012 on shutdown, close the adapter and refuse new connections', async () => {
    const { hub, connect, connectReady, options } = makeHub();
    const close = jest.spyOn(options.adapter, 'close');
    const ready = await connectReady();
    const pending = connect();
    const done = hub.shutdown();
    expect(ready.socket.closed?.code).toBe(CloseCode.Restart);
    expect(pending.socket.closed?.code).toBe(CloseCode.Restart);
    await jest.advanceTimersByTimeAsync(2_000);
    await done;
    expect(close).toHaveBeenCalled();
    const late = connect();
    expect(late.socket.closed?.code).toBe(CloseCode.Restart);
  });

  it('should terminate sockets that have not closed 2 s after shutdown', async () => {
    const { hub, connectReady } = makeHub();
    const gone = await connectReady('u1');
    const stuck = await connectReady('u2');
    const done = hub.shutdown();
    gone.handle.onClose(1012);
    await jest.advanceTimersByTimeAsync(1_999);
    expect(stuck.socket.terminated).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await done;
    expect(stuck.socket.terminated).toBe(true);
    expect(gone.socket.terminated).toBe(false);
  });

  it('should log connect and close without the token', async () => {
    const { connectReady, logger } = makeHub();
    const { handle } = await connectReady('u1@9999999999');
    handle.onClose(1000);
    const logged = JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls]);
    expect(logged).toContain('s_id1');
    expect(logged).not.toContain('9999999999');
  });
});
