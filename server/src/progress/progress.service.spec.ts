import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { aCell, aGroup, aMember, aSubmission } from '../data/repositories.contract';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { ProgressService } from './progress.service';

const game = {
  startDate: '2026-12-01',
  days: 3,
  openTime: '09:00',
  mode: 'auto' as const,
  categories: ['home' as const],
};

describe('ProgressService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let service: ProgressService;
  const ownerSubject = { kind: 'organizer' as const, id: 'owner-1' };

  beforeEach(() => {
    repos = createMemoryRepositories();
    const now = () => new Date('2026-12-02T10:00:00Z');
    const groups = new GroupsService(repos.groups, repos.members, repos.organizers, now, 'https://app.test');
    const photos = {
      viewerOf: async (kind: string, id: string, group: { id: string }) => {
        if (kind === 'organizer') {
          const playing = (await repos.members.list(group.id)).find(
            (m) => m.organizerUid === id && m.status === 'active',
          );
          return { relation: 'owner' as const, memberId: playing?.id };
        }
        return { relation: 'member' as const, memberId: id };
      },
    };
    service = new ProgressService(
      groups,
      photos as unknown as PhotosService,
      repos.members,
      repos.submissions,
      repos.cells,
      now,
    );
  });

  async function setup() {
    const group = aGroup({ game });
    await repos.groups.create(group);
    const olena = aMember(group.id, 'Olena');
    const taras = aMember(group.id, 'Taras');
    await repos.members.createUnique(olena);
    await repos.members.createUnique(taras);
    return { group, olena, taras };
  }

  it('should report zero progress for every day when nobody has submitted', async () => {
    const { group, olena } = await setup();
    const progress = await service.progressFor({ kind: 'member', id: olena.id, groupId: group.id }, group.id);
    expect(progress.days).toEqual([
      { dayIndex: 0, done: 0, total: 2, mine: false },
      { dayIndex: 1, done: 0, total: 2, mine: false },
      { dayIndex: 2, done: 0, total: 2, mine: false },
    ]);
  });

  it('should count visible photos and flag the viewer own', async () => {
    const { group, olena, taras } = await setup();
    await repos.submissions.put(aSubmission(group.id, 0, olena.id), null);
    await repos.submissions.put(aSubmission(group.id, 0, taras.id), null);
    await repos.submissions.put(aSubmission(group.id, 1, taras.id), null);
    const progress = await service.progressFor({ kind: 'member', id: olena.id, groupId: group.id }, group.id);
    expect(progress.days.map((d) => [d.done, d.mine])).toEqual([
      [2, true],
      [1, false],
      [0, false],
    ]);
  });

  it('should not count a hidden photo', async () => {
    const { group, olena } = await setup();
    await repos.submissions.put(aSubmission(group.id, 0, olena.id, { status: 'hidden' }), null);
    const progress = await service.progressFor({ kind: 'member', id: olena.id, groupId: group.id }, group.id);
    expect(progress.days[0]).toMatchObject({ done: 0, mine: false });
  });

  it('should ignore photos and seats of removed and pending members', async () => {
    const { group, olena } = await setup();
    const gone = aMember(group.id, 'Gone', { status: 'removed' });
    const waiting = aMember(group.id, 'Waiting', { status: 'pending' });
    await repos.members.createUnique(gone);
    await repos.members.createUnique(waiting);
    await repos.submissions.put(aSubmission(group.id, 0, gone.id), null);
    const progress = await service.progressFor({ kind: 'member', id: olena.id, groupId: group.id }, group.id);
    expect(progress.days[0]).toMatchObject({ done: 0, total: 2 });
  });

  it('should give an organizer who does not play no own flag', async () => {
    const { group, olena } = await setup();
    await repos.submissions.put(aSubmission(group.id, 0, olena.id), null);
    const progress = await service.progressFor(ownerSubject, group.id);
    expect(progress.days[0]).toMatchObject({ done: 1, mine: null });
  });

  it('should name the latest open day as the current one', async () => {
    const { group, olena } = await setup();
    await repos.cells.replaceAll(group.id, [
      aCell(group.id, 0, { state: 'open' }),
      aCell(group.id, 1, { state: 'open' }),
      aCell(group.id, 2, { state: 'closed' }),
    ]);
    const progress = await service.progressFor({ kind: 'member', id: olena.id, groupId: group.id }, group.id);
    expect(progress.currentDay).toBe(1);
  });

  it('should have no current day before any day opens', async () => {
    const { group, olena } = await setup();
    await repos.cells.replaceAll(group.id, [aCell(group.id, 0, { state: 'closed' })]);
    const progress = await service.progressFor({ kind: 'member', id: olena.id, groupId: group.id }, group.id);
    expect(progress.currentDay).toBeUndefined();
  });

  it('should return no days for a group without a game', async () => {
    const group = aGroup();
    await repos.groups.create(group);
    expect((await service.progressFor(ownerSubject, group.id)).days).toEqual([]);
  });
});
