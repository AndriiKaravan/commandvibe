import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { Group, Member, Notification, defaultGroupSettings } from '../data/models';
import { InMemoryPushTokenStore, PushService } from '../shared/push';
import { FakePushMessaging } from '../shared/push/testing';
import { PushNotifier } from './push-notifier';

const group: Group = {
  id: 'g1',
  ownerUid: 'u1',
  name: 'Office',
  timezone: 'Europe/Kyiv',
  status: 'active',
  settings: { ...defaultGroupSettings },
  inviteTokenHash: 'h',
  inviteClosed: false,
  createdAt: new Date(),
};

const member = (id: string, overrides: Partial<Member> = {}): Member => ({
  id,
  groupId: 'g1',
  displayName: `Secret ${id}`,
  nameKey: id,
  status: 'active',
  isOrganizer: false,
  createdAt: new Date(),
  ...overrides,
});

describe('PushNotifier', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let messaging: FakePushMessaging;
  let push: PushService;
  let now: Date;
  let notifier: PushNotifier;
  let counter: number;

  const entry = (
    memberId: string,
    kind: Notification['kind'],
    overrides: Partial<Notification> = {},
  ): Notification => ({
    id: `${memberId}_${kind}_${counter++}`,
    groupId: 'g1',
    memberId,
    kind,
    dayIndex: 0,
    createdAt: now,
    ...overrides,
  });

  const deliver = async (e: Notification) => {
    await repos.notifications.put(e);
    await notifier.deliver('g1', e);
  };

  beforeEach(async () => {
    counter = 0;
    repos = createMemoryRepositories();
    messaging = new FakePushMessaging();
    const store = new InMemoryPushTokenStore();
    push = new PushService({
      store,
      messaging,
      userIdOf: () => null,
      logger: { info: () => undefined, warn: () => undefined },
    });
    // Midday in Kyiv.
    now = new Date('2026-12-02T10:00:00Z');
    notifier = new PushNotifier(push, repos.groups, repos.members, repos.notifications, () => new Date(now));
    await repos.groups.create(group);
    await repos.members.createUnique(member('a'));
    await repos.members.createUnique(member('o', { isOrganizer: true, organizerUid: 'u1' }));
    await repos.members.createUnique(member('r', { status: 'removed' }));
    await push.registerToken('m:a', 'tok-a', 'android');
    await push.registerToken('o:u1', 'tok-org', 'web');
  });

  it('should push to the member’s devices with a generic text and a route, no names', async () => {
    await deliver(entry('a', 'day_opened'));
    expect(messaging.sentTokens).toEqual(['tok-a']);
    const message = messaging.multicasts[0];
    expect(message.data).toEqual({ route: '/g/g1/today', kind: 'day_opened' });
    expect(JSON.stringify(message)).not.toContain('Secret');
  });

  it('should send a playing organizer’s game pushes to the organizer account', async () => {
    await deliver(entry('o', 'day_opened'));
    expect(messaging.sentTokens).toEqual(['tok-org']);
  });

  it('should send organizer service pushes to the organizer account', async () => {
    await deliver(entry('org:u1', 'complaint'));
    expect(messaging.sentTokens).toEqual(['tok-org']);
    expect(messaging.multicasts[0].data?.route).toBe('/g/g1/me');
  });

  it('should not push kinds that stay in the app only', async () => {
    await deliver(entry('a', 'photos_revealed'));
    await deliver(entry('a', 'likes', { count: 2 }));
    expect(messaging.multicasts).toEqual([]);
  });

  it('should keep the entry but not push when the category is switched off', async () => {
    await repos.members.update('g1', 'a', { notify: { tasks: false, social: true } });
    await deliver(entry('a', 'day_opened'));
    await deliver(entry('a', 'comment'));
    expect(messaging.multicasts.map((m) => m.data?.kind)).toEqual(['comment']);
  });

  it('should stay silent from 22:00 to 08:00 group time', async () => {
    now = new Date('2026-12-02T20:00:00Z');
    await deliver(entry('a', 'day_opened'));
    await deliver(entry('a', 'my_turn'));
    expect(messaging.multicasts).toEqual([]);
    now = new Date('2026-12-03T06:00:00Z');
    await deliver(entry('a', 'day_opened'));
    expect(messaging.multicasts).toHaveLength(1);
  });

  it('should send three impersonal pushes a day and skip the fourth, but never skip a personal one', async () => {
    for (let i = 0; i < 4; i++) {
      await deliver(entry('a', 'comment'));
    }
    expect(messaging.multicasts).toHaveLength(3);
    await deliver(entry('a', 'my_turn'));
    expect(messaging.multicasts).toHaveLength(4);
  });

  it('should count the cap per local day', async () => {
    for (let i = 0; i < 3; i++) {
      await deliver(entry('a', 'comment'));
    }
    now = new Date('2026-12-03T10:00:00Z');
    await deliver(entry('a', 'comment'));
    expect(messaging.multicasts).toHaveLength(4);
  });

  it('should not push to a removed or unknown member', async () => {
    await push.registerToken('m:r', 'tok-r', 'ios');
    await deliver(entry('r', 'day_opened'));
    await deliver(entry('ghost', 'day_opened'));
    expect(messaging.multicasts).toEqual([]);
  });

  it('should not throw when the push service fails', async () => {
    messaging.throwOnCall(1);
    await expect(deliver(entry('a', 'day_opened'))).resolves.toBeUndefined();
  });

  it('should not count a failed send against the daily cap', async () => {
    messaging.failToken('tok-a', 'messaging/internal-error');
    for (let i = 0; i < 4; i++) {
      await deliver(entry('a', 'comment'));
    }
    expect(messaging.multicasts).toHaveLength(4);
    expect((await repos.notifications.list('g1', 'a', 50)).filter((n) => n.pushedAt)).toEqual([]);
  });
});
