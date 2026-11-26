// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { CloseCode } from './protocol';
import { NOW_MS, flush, makeHub } from './hub-test-kit';
import { RealtimeOptions } from './options';

const allowGroups: RealtimeOptions['authorizeSubscribe'] = async (_s, topic) =>
  topic.startsWith('group:');

const events = (socket: { framesOf(t: string): Record<string, unknown>[] }) =>
  socket.framesOf('event');

describe('RealtimeHub topics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
  });
  afterEach(() => jest.useRealTimers());

  describe('sub', () => {
    it('should ack ok and deliver events for an authorized topic', async () => {
      const { hub, connectReady } = makeHub({ authorizeSubscribe: allowGroups });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      await flush();
      expect(socket.sent.at(-1)).toEqual({ t: 'ack', id: 1, ok: ['group:a'] });
      hub.publish('group:a', 'rating.changed', { rev: 1 });
      await flush();
      expect(events(socket)).toEqual([
        { t: 'event', topic: 'group:a', type: 'rating.changed', data: { rev: 1 }, id: 'e_id2', ts: NOW_MS },
      ]);
    });

    it('should deny forbidden when authorizeSubscribe is missing', async () => {
      const { connectReady } = makeHub();
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      await flush();
      expect(socket.sent.at(-1)).toEqual({
        t: 'ack', id: 1, denied: [{ topic: 'group:a', reason: 'forbidden' }],
      });
    });

    it('should deny forbidden when authorizeSubscribe returns false', async () => {
      const { connectReady } = makeHub({ authorizeSubscribe: allowGroups });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['board:a'] });
      await flush();
      expect(socket.sent.at(-1)).toMatchObject({ denied: [{ topic: 'board:a', reason: 'forbidden' }] });
    });

    it('should deny forbidden and log when authorizeSubscribe throws', async () => {
      const { connectReady, logger } = makeHub({
        authorizeSubscribe: async () => {
          throw new Error('db down');
        },
      });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      await flush();
      expect(socket.sent.at(-1)).toMatchObject({ denied: [{ topic: 'group:a', reason: 'forbidden' }] });
      expect(logger.error).toHaveBeenCalled();
      expect(socket.closed).toBeUndefined();
    });

    it('should deny invalid for a malformed topic', async () => {
      const { connectReady } = makeHub({ authorizeSubscribe: allowGroups });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['nocolon'] });
      await flush();
      expect(socket.sent.at(-1)).toMatchObject({ denied: [{ topic: 'nocolon', reason: 'invalid' }] });
    });

    it('should deny limit beyond maxTopicsPerSession', async () => {
      const { connectReady } = makeHub({
        authorizeSubscribe: allowGroups,
        limits: { maxTopicsPerSession: 2 },
      });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a', 'group:b', 'group:c'] });
      await flush();
      expect(socket.sent.at(-1)).toEqual({
        t: 'ack', id: 1, ok: ['group:a', 'group:b'], denied: [{ topic: 'group:c', reason: 'limit' }],
      });
    });

    it('should ack an already delivered topic without asking authorizeSubscribe again', async () => {
      const authorizeSubscribe = jest.fn(allowGroups);
      const { connectReady } = makeHub({
        authorizeSubscribe,
        initialTopics: async () => ['profile:p1'],
      });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      send({ t: 'sub', id: 2, topics: ['group:a', 'profile:p1'] });
      await flush();
      expect(socket.sent.at(-1)).toEqual({ t: 'ack', id: 2, ok: ['group:a', 'profile:p1'] });
      expect(authorizeSubscribe).toHaveBeenCalledTimes(1);
    });

    it('should not register a topic whose authorization resolves after the session closed', async () => {
      let release!: (value: boolean) => void;
      const { hub, connectReady } = makeHub({
        authorizeSubscribe: () => new Promise<boolean>((resolve) => (release = resolve)),
      });
      const { socket, send, handle } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      await flush();
      handle.onClose(1006);
      release(true);
      await flush();
      expect(socket.framesOf('ack')).toEqual([]);
      expect(hub.stats()).toEqual({ connections: 0, topics: 0 });
    });

    it('should apply sub and unsub in the order they were sent', async () => {
      const { hub, connectReady } = makeHub({
        authorizeSubscribe: async (_s, topic) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return topic.startsWith('group:');
        },
      });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      send({ t: 'unsub', id: 2, topics: ['group:a'] });
      await jest.advanceTimersByTimeAsync(200);
      hub.publish('group:a', 'x', {});
      await flush();
      expect(events(socket)).toEqual([]);
    });
  });

  describe('unsub', () => {
    it('should stop delivery after unsub', async () => {
      const { hub, connectReady } = makeHub({ authorizeSubscribe: allowGroups });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      send({ t: 'unsub', id: 2, topics: ['group:a'] });
      await flush();
      expect(socket.sent.at(-1)).toEqual({ t: 'ack', id: 2, ok: ['group:a'] });
      hub.publish('group:a', 'x', {});
      expect(events(socket)).toEqual([]);
      expect(hub.stats().topics).toBe(0);
    });

    it('should deny assigned for a server-assigned topic and keep delivering it', async () => {
      const { hub, connectReady } = makeHub({ initialTopics: async () => ['profile:p1'] });
      const { socket, send } = await connectReady();
      send({ t: 'unsub', id: 1, topics: ['profile:p1'] });
      await flush();
      expect(socket.sent.at(-1)).toEqual({
        t: 'ack', id: 1, denied: [{ topic: 'profile:p1', reason: 'assigned' }],
      });
      hub.publish('profile:p1', 'x', {});
      expect(events(socket)).toHaveLength(1);
    });
  });

  describe('publish', () => {
    const setup = async () => {
      const kit = makeHub({ initialTopics: async (s) => (s.userId === 'u3' ? [] : ['profile:p1']) });
      const a1 = await kit.connectReady('u1');
      const a2 = await kit.connectReady('u1');
      const b = await kit.connectReady('u2');
      const outsider = await kit.connectReady('u3');
      return { ...kit, a1, a2, b, outsider };
    };

    it('should deliver only to sessions with the topic', async () => {
      const { hub, a1, a2, b, outsider } = await setup();
      hub.publish('profile:p1', 'medication.updated', { id: 'm1' });
      for (const client of [a1, a2, b]) expect(events(client.socket)).toHaveLength(1);
      expect(events(outsider.socket)).toEqual([]);
    });

    it('should skip every session of exceptUserId', async () => {
      const { hub, a1, a2, b } = await setup();
      hub.publish('profile:p1', 'x', {}, { exceptUserId: 'u1' });
      expect(events(a1.socket)).toEqual([]);
      expect(events(a2.socket)).toEqual([]);
      expect(events(b.socket)).toHaveLength(1);
    });

    it('should skip only the exceptSession so the author’s other device still receives', async () => {
      const { hub, a1, a2 } = await setup();
      const sid = a1.socket.sent[0].sid as string;
      hub.publish('profile:p1', 'x', {}, { exceptSession: { sid, userId: 'u1' } });
      expect(events(a1.socket)).toEqual([]);
      expect(events(a2.socket)).toHaveLength(1);
    });

    it('should not let a sid of another user suppress that user’s event', async () => {
      const { hub, a1, b } = await setup();
      const sidOfB = b.socket.sent[0].sid as string;
      // The caller names user u1 as the author but passes B's sid (taken from an untrusted header).
      hub.publish('profile:p1', 'x', {}, { exceptSession: { sid: sidOfB, userId: 'u1' } });
      expect(events(b.socket)).toHaveLength(1);
      expect(events(a1.socket)).toHaveLength(1);
    });

    it('should deliver instead of suppressing when exceptSession is malformed', async () => {
      const { hub, b, logger } = await setup();
      const sidOfB = b.socket.sent[0].sid as string;
      hub.publish('profile:p1', 'x', {}, { exceptSession: { sid: sidOfB } as unknown as { sid: string; userId: string } });
      expect(events(b.socket)).toHaveLength(1);
      expect(logger.error).toHaveBeenCalledWith('realtime.invalid_except_session', expect.anything());
    });

    it('should not throw when a JS caller passes null instead of options', async () => {
      const { hub, b } = await setup();
      expect(() => hub.publish('profile:p1', 'x', {}, null as unknown as undefined)).not.toThrow();
      expect(events(b.socket)).toHaveLength(1);
    });

    it('should give each publish a unique id and ts = now', async () => {
      const { hub, b } = await setup();
      hub.publish('profile:p1', 'x', {});
      jest.setSystemTime(NOW_MS + 5);
      hub.publish('profile:p1', 'x', {});
      const [first, second] = events(b.socket);
      expect(first.id).not.toEqual(second.id);
      expect([first.ts, second.ts]).toEqual([NOW_MS, NOW_MS + 5]);
    });

    it('should deliver once when the topic is both assigned and subscribed', async () => {
      const { hub, connectReady } = makeHub({
        initialTopics: async () => ['group:a'],
        authorizeSubscribe: allowGroups,
      });
      const { socket, send } = await connectReady();
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      await flush();
      hub.publish('group:a', 'x', {});
      expect(events(socket)).toHaveLength(1);
    });

    it('should not throw and log an error when the event exceeds maxEventBytes', async () => {
      const { hub, b, logger } = await setup();
      expect(() => hub.publish('profile:p1', 'x', { blob: 'x'.repeat(65_536) })).not.toThrow();
      expect(events(b.socket)).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('realtime.event_too_large', expect.anything());
    });

    it('should not throw when data cannot be serialized', async () => {
      const { hub, b, logger } = await setup();
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => hub.publish('profile:p1', 'x', circular)).not.toThrow();
      expect(events(b.socket)).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should not throw when the adapter rejects', async () => {
      const { hub, logger, options } = makeHub();
      jest.spyOn(options.adapter, 'publish').mockRejectedValue(new Error('pubsub down'));
      expect(() => hub.publish('profile:p1', 'x', {})).not.toThrow();
      await flush();
      expect(logger.error).toHaveBeenCalledWith('realtime.adapter_failed', expect.anything());
    });

    it('should not throw for an invalid topic', async () => {
      const { hub, logger } = makeHub();
      expect(() => hub.publish('bad topic', 'x', {})).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should close 1013 instead of sending when bufferedAmount exceeds 1 MiB', async () => {
      const { hub, a1, b } = await setup();
      a1.socket.bufferedAmount = 1_048_577;
      hub.publish('profile:p1', 'x', {});
      expect(a1.socket.closed?.code).toBe(CloseCode.TryAgainLater);
      expect(events(a1.socket)).toEqual([]);
      expect(events(b.socket)).toHaveLength(1);
    });
  });

  describe('control', () => {
    it('refreshTopics should send add/remove and change delivery', async () => {
      let assigned = ['profile:p1', 'profile:p9'];
      const { hub, connectReady } = makeHub({ initialTopics: async () => assigned });
      const { socket } = await connectReady('u1');
      assigned = ['profile:p1', 'profile:p2'];
      hub.refreshTopics('u1');
      await flush();
      expect(socket.sent.at(-1)).toEqual({ t: 'topics', add: ['profile:p2'], remove: ['profile:p9'] });
      hub.publish('profile:p9', 'x', {});
      hub.publish('profile:p2', 'x', {});
      expect(events(socket).map((e) => e.topic)).toEqual(['profile:p2']);
    });

    it('refreshTopics should drop a subscription that authorizeSubscribe now refuses', async () => {
      let allowed = true;
      const { hub, connectReady } = makeHub({ authorizeSubscribe: async () => allowed });
      const { socket, send } = await connectReady('u1');
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      await flush();
      allowed = false;
      hub.refreshTopics('u1');
      await flush();
      expect(socket.sent.at(-1)).toEqual({ t: 'topics', add: [], remove: ['group:a'] });
      hub.publish('group:a', 'x', {});
      expect(events(socket)).toEqual([]);
    });

    it('refreshTopics should keep a topic that stays delivered through the other set', async () => {
      let assigned = ['group:a'];
      const { hub, connectReady } = makeHub({
        initialTopics: async () => assigned,
        authorizeSubscribe: allowGroups,
      });
      const { socket, send } = await connectReady('u1');
      send({ t: 'sub', id: 1, topics: ['group:a'] });
      await flush();
      assigned = [];
      hub.refreshTopics('u1');
      await flush();
      expect(socket.framesOf('topics')).toEqual([]);
      hub.publish('group:a', 'x', {});
      expect(events(socket)).toHaveLength(1);
    });

    it('refreshTopics should send nothing when nothing changed', async () => {
      const { hub, connectReady } = makeHub({ initialTopics: async () => ['profile:p1'] });
      const { socket } = await connectReady('u1');
      hub.refreshTopics('u1');
      await flush();
      expect(socket.framesOf('topics')).toEqual([]);
    });

    it('disconnectUser should close every session of the user with 4403 and leave others', async () => {
      const { hub, connectReady } = makeHub();
      const a1 = await connectReady('u1');
      const a2 = await connectReady('u1');
      const b = await connectReady('u2');
      hub.disconnectUser('u1');
      await flush();
      expect(a1.socket.closed?.code).toBe(CloseCode.Forbidden);
      expect(a2.socket.closed?.code).toBe(CloseCode.Forbidden);
      expect(b.socket.closed).toBeUndefined();
    });

    it('should route events and control commands through the adapter', async () => {
      const { hub, options } = makeHub();
      const publish = jest.spyOn(options.adapter, 'publish');
      hub.publish('profile:p1', 'x', {});
      hub.disconnectUser('u1');
      hub.refreshTopics('u1');
      expect(publish.mock.calls.map(([m]) => m.kind)).toEqual(['event', 'disconnectUser', 'refreshTopics']);
    });
  });

  describe('limits', () => {
    it('should close a new connection 4429 when the user already has 10 sessions', async () => {
      const { connectReady } = makeHub();
      for (let i = 0; i < 10; i++) await connectReady('u1');
      const eleventh = await connectReady('u1');
      expect(eleventh.socket.closed?.code).toBe(CloseCode.TooMany);
      const other = await connectReady('u2');
      expect(other.socket.sent[0]).toMatchObject({ t: 'ready' });
    });

    it('should accept a new connection while 9 stale sessions of the same user await the idle timeout', async () => {
      const { connectReady } = makeHub();
      const stale = [];
      for (let i = 0; i < 9; i++) stale.push(await connectReady('u1'));
      await jest.advanceTimersByTimeAsync(59_000);
      const fresh = await connectReady('u1');
      expect(fresh.socket.sent[0]).toMatchObject({ t: 'ready' });
      await jest.advanceTimersByTimeAsync(1_000);
      expect(stale.every((s) => s.socket.closed?.code === CloseCode.GoingAway)).toBe(true);
      expect(fresh.socket.closed).toBeUndefined();
    });
  });

  it('stats should count connections and topics', async () => {
    const { hub, connectReady } = makeHub({ initialTopics: async (s) => [`profile:${s.userId}`] });
    await connectReady('u1');
    await connectReady('u2');
    expect(hub.stats()).toEqual({ connections: 2, topics: 2 });
  });
});
