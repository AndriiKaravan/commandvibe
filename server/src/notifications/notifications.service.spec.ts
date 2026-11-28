import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { Member } from '../data/models';
import { PhotoEvents } from '../photos/photo-events';
import { maxNotificationsPerMember } from './notification-kinds';
import { NotificationsService } from './notifications.service';

class RecordingEvents implements PhotoEvents {
  readonly group: { event: string; payload: Record<string, unknown> }[] = [];
  readonly owner: { event: string; payload: Record<string, unknown> }[] = [];
  toGroup(_: string, event: string, payload: Record<string, unknown>): void {
    this.group.push({ event, payload });
  }
  toOwner(_: string, event: string, payload: Record<string, unknown>): void {
    this.owner.push({ event, payload });
  }
}

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

describe('NotificationsService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let events: RecordingEvents;
  let now: Date;
  let service: NotificationsService;

  beforeEach(async () => {
    repos = createMemoryRepositories();
    events = new RecordingEvents();
    now = new Date('2026-12-02T09:00:00Z');
    service = new NotificationsService(repos.notifications, repos.members, events, () => new Date(now));
    await repos.members.createUnique(member('a'));
    await repos.members.createUnique(member('b'));
  });

  const record = (overrides: Record<string, unknown> = {}) =>
    service.record({ groupId: 'g1', memberId: 'a', kind: 'day_opened', key: 'd0', dayIndex: 0, ...overrides });

  it('should record an event once per key', async () => {
    expect(await record()).toBeDefined();
    expect(await record()).toBeUndefined();
    expect((await service.list('g1', ['a'])).items).toHaveLength(1);
  });

  it('should tell the addressee over the group topic without naming anything else', async () => {
    await record();
    expect(events.group).toEqual([{ event: 'notification.created', payload: { recipients: ['a'] } }]);
  });

  it('should tell only the owner topic about an organizer-only entry', async () => {
    await record({ memberId: 'org:u1', kind: 'complaint', key: 'c1', owner: true });
    expect(events.group).toEqual([]);
    expect(events.owner).toEqual([{ event: 'notification.created', payload: { recipients: ['org:u1'] } }]);
  });

  it('should drop the oldest entry beyond the cap', async () => {
    for (let i = 0; i <= maxNotificationsPerMember; i++) {
      now = new Date(now.getTime() + 1000);
      await record({ key: `k${i}` });
    }
    const { items } = await service.list('g1', ['a']);
    expect(items).toHaveLength(maxNotificationsPerMember);
    expect(items.some((n) => n.id === 'a_k0')).toBe(false);
  });

  it('should list unread count, read state and the actor name', async () => {
    await record({ kind: 'comment', key: 'c1', actorMemberId: 'b' });
    await record({ key: 'd1' });
    await service.markRead('g1', ['a'], ['a_d1']);
    const page = await service.list('g1', ['a']);
    expect(page.unread).toBe(1);
    const comment = page.items.find((n) => n.kind === 'comment');
    expect(comment).toMatchObject({ actorName: 'B', read: false });
    expect(page.items.find((n) => n.id === 'a_d1')?.read).toBe(true);
  });

  it('should leave a removed actor unnamed', async () => {
    await repos.members.createUnique(member('x', { status: 'removed' }));
    await record({ kind: 'comment', key: 'c1', actorMemberId: 'x' });
    const item = (await service.list('g1', ['a'])).items[0];
    expect(item.actorName).toBeUndefined();
  });

  it('should merge the entries of a playing organizer’s two keys, newest first', async () => {
    await record({ memberId: 'a', key: 'd0' });
    now = new Date(now.getTime() + 1000);
    await record({ memberId: 'org:u1', kind: 'complaint', key: 'c1', owner: true });
    const { items } = await service.list('g1', ['a', 'org:u1']);
    expect(items.map((n) => n.kind)).toEqual(['complaint', 'day_opened']);
  });

  it('should mark read only the caller’s own entries', async () => {
    await record();
    await record({ memberId: 'b' });
    await service.markRead('g1', ['a'], undefined);
    expect((await service.list('g1', ['b'])).unread).toBe(1);
    expect((await service.list('g1', ['a'])).unread).toBe(0);
  });

  it('should reopen and re-sort an upserted entry', async () => {
    await record({ kind: 'likes', key: 'l1', count: 1, upsert: true });
    await service.markRead('g1', ['a'], undefined);
    now = new Date(now.getTime() + 1000);
    await record({ kind: 'likes', key: 'l1', count: 2, upsert: true });
    const page = await service.list('g1', ['a']);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ count: 2, read: false });
  });

  it('should tell the group topic, and the owner topic for service keys, when entries are read', async () => {
    await service.markRead('g1', ['a', 'org:u1'], undefined);
    expect(events.group).toEqual([{ event: 'notification.read', payload: { recipients: ['a', 'org:u1'] } }]);
    expect(events.owner).toEqual([{ event: 'notification.read', payload: { recipients: ['org:u1'] } }]);
  });
});
