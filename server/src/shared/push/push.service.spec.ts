// generated from ks_server/push — do not edit; run: npm run sync:push
import { InMemoryPushTokenStore } from './in-memory-push-token-store';
import { PushService } from './push.service';
import { PushOptions, PushTokenStore } from './push.types';
import { FakePushMessaging, RecordingPushLogger } from './testing';

const content = { notification: { title: 'App', body: 'Something new' }, data: { type: 'x' } };

async function setup(overrides: Partial<PushOptions> = {}) {
  const store = new InMemoryPushTokenStore({ maxTokensPerUser: 2000 });
  const messaging = new FakePushMessaging();
  const logger = new RecordingPushLogger();
  const service = new PushService({ store, messaging, logger, userIdOf: () => undefined, ...overrides });
  return { store, messaging, logger, service };
}

describe('PushService', () => {
  describe('sendToUsers', () => {
    it('should multicast the content to every token of the given accounts only', async () => {
      const { store, messaging, service } = await setup();
      await store.register('u1', 'tok-1a', 'android');
      await store.register('u1', 'tok-1b', 'ios');
      await store.register('u2', 'tok-2', 'web');
      await store.register('u3', 'tok-3', 'web');

      const report = await service.sendToUsers(['u1', 'u2', 'u1'], content);

      expect(messaging.multicasts).toHaveLength(1);
      expect(messaging.multicasts[0]).toEqual({ ...content, tokens: expect.any(Array) });
      expect(messaging.sentTokens.sort()).toEqual(['tok-1a', 'tok-1b', 'tok-2']);
      expect(report).toEqual({ tokens: 3, sent: 3, failed: 0, removed: 0, topicSent: 0, topicFailed: 0, errors: {} });
    });

    it('should not call FCM when there are no accounts or no tokens', async () => {
      const { messaging, service } = await setup();
      expect((await service.sendToUsers([], content)).tokens).toBe(0);
      expect((await service.sendToUsers(['nobody'], content)).tokens).toBe(0);
      expect(messaging.multicasts).toEqual([]);
    });

    it('should split tokens into multicasts of at most 500', async () => {
      const { store, messaging, service } = await setup();
      for (let i = 0; i < 1201; i++) await store.register('u1', `tok-${i}`, 'android');
      const report = await service.sendToUsers(['u1'], content);
      expect(messaging.multicasts.map((m) => m.tokens.length)).toEqual([500, 500, 201]);
      expect(new Set(messaging.sentTokens).size).toBe(1201);
      expect(report.sent).toBe(1201);
    });

    it('should forget tokens FCM reports as not registered or invalid, and keep the rest', async () => {
      const { store, messaging, service } = await setup();
      await store.register('u1', 'gone', 'android');
      await store.register('u1', 'bad', 'android');
      await store.register('u1', 'busy', 'android');
      await store.register('u1', 'ok', 'android');
      messaging
        .failToken('gone', 'messaging/registration-token-not-registered')
        .failToken('bad', 'messaging/invalid-registration-token')
        .failToken('busy', 'messaging/internal-error');

      const report = await service.sendToUsers(['u1'], content);

      expect((await store.tokensOf(['u1'])).sort()).toEqual(['busy', 'ok']);
      expect(report).toMatchObject({ sent: 1, failed: 3, removed: 2 });
      expect(report.errors).toEqual({
        'messaging/registration-token-not-registered': 1,
        'messaging/invalid-registration-token': 1,
        'messaging/internal-error': 1,
      });
    });

    it('should keep invalid-argument tokens even when other tokens of the batch went through', async () => {
      // A payload can be invalid for one platform only (bad apns / webpush override).
      const { store, messaging, service } = await setup();
      await store.register('u1', 'ios-token', 'ios');
      await store.register('u1', 'android-token', 'android');
      messaging.failToken('ios-token', 'messaging/invalid-argument');
      const report = await service.sendToUsers(['u1'], content);
      expect((await store.tokensOf(['u1'])).sort()).toEqual(['android-token', 'ios-token']);
      expect(report).toMatchObject({ sent: 1, failed: 1, removed: 0, errors: { 'messaging/invalid-argument': 1 } });
    });

    it('should count a rejected multicast as failed and still send the next batches', async () => {
      const { store, messaging, service } = await setup();
      for (let i = 0; i < 600; i++) await store.register('u1', `tok-${i}`, 'android');
      messaging.throwOnCall(1);
      const report = await service.sendToUsers(['u1'], content);
      expect(report).toMatchObject({ tokens: 600, sent: 100, failed: 500, removed: 0 });
      expect(report.errors).toEqual({ 'app/network-error': 500 });
    });

    it('should resolve without sending when the token lookup fails', async () => {
      const store: PushTokenStore = {
        register: async () => undefined,
        remove: async () => undefined,
        forget: async () => undefined,
        removeAllOf: async () => undefined,
        tokensOf: async () => Promise.reject(Object.assign(new Error('down'), { code: 14 })),
      };
      const { messaging, logger, service } = await setup({ store });
      const report = await service.sendToUsers(['u1'], content);
      expect(report).toMatchObject({ sent: 0, failed: 0, errors: { 'store/lookup-failed': 1 } });
      expect(messaging.multicasts).toEqual([]);
      expect(logger.lines.some((line) => line.level === 'warn')).toBe(true);
    });

    it('should still report the send when forgetting gone tokens fails', async () => {
      const inner = new InMemoryPushTokenStore();
      await inner.register('u1', 'gone', 'android');
      const store: PushTokenStore = {
        register: (...args) => inner.register(...args),
        remove: (...args) => inner.remove(...args),
        tokensOf: (...args) => inner.tokensOf(...args),
        removeAllOf: (...args) => inner.removeAllOf(...args),
        forget: async () => Promise.reject(new Error('down')),
      };
      const { messaging, service } = await setup({ store });
      messaging.failToken('gone', 'messaging/registration-token-not-registered');
      await expect(service.sendToUsers(['u1'], content)).resolves.toMatchObject({ failed: 1, removed: 0 });
    });

    it('should also send to each account topic in the transition period', async () => {
      const { store, messaging, service } = await setup({ legacyUserTopic: (uid) => `user-${uid}` });
      await store.register('u1', 'tok-1', 'android');
      messaging.failTopic('user-u2', 'messaging/internal-error');

      const report = await service.sendToUsers(['u1', 'u2', 'u1'], content);

      expect(messaging.topicMessages).toEqual([
        { ...content, topic: 'user-u1' },
        { ...content, topic: 'user-u2' },
      ]);
      expect(report).toMatchObject({ sent: 1, topicSent: 1, topicFailed: 1 });
    });

    it('should resolve when the legacy topic callback throws', async () => {
      const { store, service } = await setup({
        legacyUserTopic: () => {
          throw new Error('bad topic');
        },
      });
      await store.register('u1', 'tok-1', 'android');
      await expect(service.sendToUsers(['u1'], content)).resolves.toMatchObject({ sent: 1, topicFailed: 1 });
    });

    it('should resolve when the logger throws', async () => {
      const { store, service } = await setup({
        logger: {
          info: () => {
            throw new Error('logger down');
          },
          warn: () => undefined,
        },
      });
      await store.register('u1', 'tok-1', 'android');
      await expect(service.sendToUsers(['u1'], content)).resolves.toMatchObject({ sent: 1 });
    });

    it('should not send to topics without a legacy topic option', async () => {
      const { store, messaging, service } = await setup();
      await store.register('u1', 'tok-1', 'android');
      await service.sendToUsers(['u1'], content);
      expect(messaging.topicMessages).toEqual([]);
    });

    it('should log counts and error codes but never tokens, account ids or content', async () => {
      const { store, messaging, logger, service } = await setup({ legacyUserTopic: (uid) => `topic-${uid}` });
      await store.register('secret-uid', 'secret-token', 'android');
      await store.register('secret-uid', 'other-token', 'android');
      messaging.failToken('secret-token', 'messaging/registration-token-not-registered');
      messaging.failTopic('topic-secret-uid', 'messaging/internal-error');
      messaging.throwOnCall(3);

      await service.sendToUsers(['secret-uid'], { notification: { title: 'Aspirin 500mg' }, data: { med: 'Aspirin' } });
      await service.sendToTopic('topic-secret-uid', content);

      expect(logger.lines.length).toBeGreaterThan(0);
      expect(logger.text).not.toMatch(/secret|Aspirin|other-token/);
      expect(logger.text).toMatch(/registration-token-not-registered/);
    });
  });

  describe('sendToTopic', () => {
    it('should send the content to the topic and report success', async () => {
      const { messaging, service } = await setup();
      await expect(service.sendToTopic('all', content)).resolves.toBe(true);
      expect(messaging.topicMessages).toEqual([{ ...content, topic: 'all' }]);
    });

    it('should resolve false instead of throwing when FCM rejects', async () => {
      const { messaging, service } = await setup();
      messaging.failTopic('all', 'messaging/invalid-argument');
      await expect(service.sendToTopic('all', content)).resolves.toBe(false);
    });
  });

  describe('tokens', () => {
    it('should register, remove and remove all through the store', async () => {
      const { store, service } = await setup();
      await service.registerToken('u1', 'a', 'android');
      await service.registerToken('u1', 'b', 'ios');
      await service.registerToken('u2', 'c', 'web');
      await service.removeToken('u1', 'a');
      expect(await store.tokensOf(['u1'])).toEqual(['b']);
      await service.removeAllOf('u2');
      expect(await store.tokensOf(['u2'])).toEqual([]);
    });
  });
});
