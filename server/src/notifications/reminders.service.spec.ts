import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { Cell, Group, Member, Submission, defaultGroupSettings } from '../data/models';
import { PhotoEvents } from '../photos/photo-events';
import { NotificationSources } from './notification-sources';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';

const events: PhotoEvents = { toGroup: () => undefined, toOwner: () => undefined };

const group = (overrides: Partial<Group> = {}): Group => ({
  id: 'g1',
  ownerUid: 'u1',
  name: 'Office',
  timezone: 'Europe/Kyiv',
  status: 'active',
  settings: { ...defaultGroupSettings },
  game: { startDate: '2026-12-02', days: 7, openTime: '09:00', mode: 'auto', categories: ['home'] } as Group['game'],
  inviteTokenHash: 'h',
  inviteClosed: false,
  createdAt: new Date(),
  ...overrides,
});

const member = (id: string, status: Member['status'] = 'active'): Member => ({
  id,
  groupId: 'g1',
  displayName: `Secret ${id}`,
  nameKey: id,
  status,
  isOrganizer: false,
  createdAt: new Date(),
});

const cell = (dayIndex: number, opensAt: string, state: Cell['state'] = 'open'): Cell => ({
  groupId: 'g1',
  dayIndex,
  task: { kind: 'catalog', taskId: 't' },
  opensAt: new Date(opensAt),
  state,
});

const submission = (memberId: string, status: Submission['status'] = 'visible'): Submission =>
  ({
    groupId: 'g1',
    dayIndex: 0,
    memberId,
    version: 'v',
    photoPath: 'p',
    blurPath: 'b',
    width: 1,
    height: 1,
    submittedAt: new Date(),
    updatedAt: new Date(),
    source: 'camera',
    flags: { takenBefore: false },
    status,
  }) as Submission;

describe('RemindersService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let reminders: RemindersService;
  let now: Date;
  let delivered: string[];

  const entriesOf = async (key: string) => (await repos.notifications.list('g1', key, 50)).map((n) => n.kind);
  // 19:00 Kyiv in December.
  const at = (hhmm: string) => new Date(`2026-12-02T${hhmm}:00Z`);

  async function setup(g: Group = group()) {
    repos = createMemoryRepositories();
    const service = new NotificationsService(repos.notifications, repos.members, events, () => new Date(now));
    delivered = [];
    const sources = new NotificationSources(service, repos.members, repos.groups, repos.likes, repos.notifications, {
      deliver: async (_, entry) => {
        delivered.push(entry.memberId);
      },
    });
    reminders = new RemindersService(repos.groups, repos.cells, repos.members, repos.submissions, sources);
    await repos.groups.create(g);
    await repos.cells.replaceAll('g1', [cell(0, '2026-12-02T07:00:00Z'), cell(1, '2026-12-03T07:00:00Z', 'closed')]);
    for (const m of [member('a'), member('b'), member('c', 'removed'), member('d', 'pending')]) {
      await repos.members.createUnique(m);
    }
    await repos.submissions.put(submission('b'), null);
  }

  it('should remind from 19:00 only those who have not done the day', async () => {
    now = at('16:59');
    await setup();
    expect(await reminders.run(now)).toBe(0);
    now = at('17:00');
    expect(await reminders.run(now)).toBe(1);
    expect(await entriesOf('a')).toEqual(['reminder']);
    for (const key of ['b', 'c', 'd']) {
      expect(await entriesOf(key)).toEqual([]);
    }
  });

  it('should count a hidden photo as done', async () => {
    now = at('17:00');
    await setup();
    await repos.submissions.put(submission('a', 'hidden'), null);
    expect(await reminders.run(now)).toBe(0);
  });

  it('should remind once a day however often the tick runs', async () => {
    now = at('17:00');
    await setup();
    await reminders.run(now);
    now = at('17:01');
    expect(await reminders.run(now)).toBe(0);
    expect(delivered).toEqual(['a']);
  });

  it('should stop at 22:00 before the quiet hours', async () => {
    now = at('20:00');
    await setup();
    expect(await reminders.run(now)).toBe(0);
  });

  it('should do nothing when the day is not open, the game is finished or has not begun', async () => {
    now = at('17:00');
    await setup();
    await repos.cells.replaceAll('g1', [cell(0, '2026-12-02T07:00:00Z', 'closed')]);
    expect(await reminders.run(now)).toBe(0);
    await setup(group({ status: 'finished' }));
    expect(await reminders.run(now)).toBe(0);
    await setup();
    await repos.cells.replaceAll('g1', [cell(0, '2026-12-03T07:00:00Z')]);
    expect(await reminders.run(now)).toBe(0);
  });

  it('should use each group’s own clock', async () => {
    now = at('17:00');
    await setup(group({ timezone: 'America/New_York' }));
    expect(await reminders.run(now)).toBe(0);
  });

  it('should keep the text free of names and numbers about others', async () => {
    now = at('17:00');
    await setup();
    await reminders.run(now);
    const [entry] = await repos.notifications.list('g1', 'a', 5);
    expect(JSON.stringify(entry)).not.toMatch(/Secret|count/);
  });
});
