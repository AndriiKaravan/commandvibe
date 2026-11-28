import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { Group, Member, defaultGroupSettings } from '../data/models';
import { PhotoEvents } from '../photos/photo-events';
import { NotificationSources } from './notification-sources';
import { NotificationsService } from './notifications.service';

const events: PhotoEvents = { toGroup: () => undefined, toOwner: () => undefined };

const member = (id: string, overrides: Partial<Member> = {}): Member => ({
  id,
  groupId: 'g1',
  displayName: id.toUpperCase(),
  nameKey: id,
  status: 'active',
  isOrganizer: false,
  createdAt: new Date(),
  ...overrides,
});

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

describe('NotificationSources', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let sources: NotificationSources;
  let now: Date;

  const listOf = async (key: string) => (await repos.notifications.list('g1', key, 50)).map((n) => n.kind);

  beforeEach(async () => {
    repos = createMemoryRepositories();
    now = new Date('2026-12-02T09:00:00Z');
    const service = new NotificationsService(repos.notifications, repos.members, events, () => new Date(now));
    sources = new NotificationSources(service, repos.members, repos.groups, repos.likes, repos.notifications);
    await repos.groups.create(group);
    for (const m of [
      member('a'),
      member('b'),
      member('c', { status: 'removed' }),
      member('d', { status: 'pending' }),
      member('o', { isOrganizer: true, organizerUid: 'u1' }),
    ]) {
      await repos.members.createUnique(m);
    }
  });

  it('should tell every active player, the playing organizer included, that a day opened', async () => {
    await sources.dayOpened('g1', 0);
    for (const key of ['a', 'b', 'o']) {
      expect(await listOf(key)).toEqual(['day_opened']);
    }
    for (const key of ['c', 'd', 'org:u1']) {
      expect(await listOf(key)).toEqual([]);
    }
  });

  it('should not repeat a day announcement', async () => {
    await sources.dayOpened('g1', 0);
    await sources.dayOpened('g1', 0);
    expect(await listOf('a')).toEqual(['day_opened']);
  });

  it('should tell active players that photos were revealed', async () => {
    await sources.photosRevealed('g1', 2);
    expect(await listOf('b')).toEqual(['photos_revealed']);
    expect(await listOf('c')).toEqual([]);
  });

  it('should tell only the chosen member that it is their turn', async () => {
    await sources.myTurn('g1', 1, 'a');
    expect(await listOf('a')).toEqual(['my_turn']);
    expect(await listOf('b')).toEqual([]);
  });

  it('should tell the photo’s author about a comment, never the commenter themselves', async () => {
    await sources.comment('g1', 0, 'a', 'b', 'c1');
    await sources.comment('g1', 0, 'a', 'a', 'c2');
    expect(await listOf('a')).toEqual(['comment']);
    expect(await listOf('b')).toEqual([]);
  });

  it('should not tell a removed author about a comment', async () => {
    await sources.comment('g1', 0, 'c', 'a', 'c1');
    expect(await listOf('c')).toEqual([]);
  });

  it('should keep one likes entry per photo and raise its count as likes arrive', async () => {
    const like = (liker: string) =>
      repos.likes.add({ groupId: 'g1', dayIndex: 0, authorMemberId: 'a', likerMemberId: liker, createdAt: now });
    await like('b');
    await sources.likes('g1', 0, 'a');
    await like('o');
    await sources.likes('g1', 0, 'a');
    const [entry] = await repos.notifications.list('g1', 'a', 10);
    expect(await listOf('a')).toEqual(['likes']);
    expect(entry.count).toBe(2);
  });

  it('should count only active likers and not react to a lone withdrawn like', async () => {
    await repos.likes.add({ groupId: 'g1', dayIndex: 0, authorMemberId: 'a', likerMemberId: 'c', createdAt: now });
    await sources.likes('g1', 0, 'a');
    expect(await listOf('a')).toEqual([]);
  });

  it('should tell the organizer about a pending member and a complaint under their own key', async () => {
    await sources.pendingMember('g1', 'd');
    await sources.complaint('g1', 0, 'a');
    await sources.complaint('g1', 0, 'a');
    expect(await listOf('org:u1')).toEqual(expect.arrayContaining(['pending_member', 'complaint']));
    expect(await listOf('org:u1')).toHaveLength(2);
    expect(await listOf('o')).toEqual([]);
  });

  it('should survive a failing store without throwing into the game', async () => {
    const broken = new NotificationSources(
      { record: () => Promise.reject(new Error('boom')) } as unknown as NotificationsService,
      repos.members,
      repos.groups,
      repos.likes,
      repos.notifications,
    );
    await expect(broken.dayOpened('g1', 0)).resolves.toBeUndefined();
  });
});
