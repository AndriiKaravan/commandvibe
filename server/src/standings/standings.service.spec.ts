import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { aGroup, aMember, aSubmission } from '../data/repositories.contract';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { StandingsService } from './standings.service';

const game = {
  startDate: '2026-12-01',
  days: 7,
  openTime: '09:00',
  mode: 'auto' as const,
  categories: ['home' as const],
};

describe('StandingsService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let service: StandingsService;
  const ownerSubject = { kind: 'organizer' as const, id: 'owner-1' };

  beforeEach(() => {
    repos = createMemoryRepositories();
    const now = () => new Date('2026-12-05T10:00:00Z');
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
    service = new StandingsService(groups, photos as unknown as PhotosService, repos.members, repos.submissions, now);
  });

  async function player(groupId: string, name: string, days: number[], extra: Parameters<typeof aMember>[2] = {}) {
    const member = aMember(groupId, name, extra);
    await repos.members.createUnique(member);
    for (const day of days) {
      await repos.submissions.put(aSubmission(groupId, day, member.id), null);
    }
    return member;
  }

  async function started() {
    const group = aGroup({ game });
    await repos.groups.create(group);
    return group;
  }

  const asMember = (id: string, groupId: string) => ({ kind: 'member' as const, id, groupId });

  it('should return an empty list for a group nobody plays in', async () => {
    const group = await started();
    const result = await service.standings(ownerSubject, group.id);
    expect(result.items).toEqual([]);
    expect(result.me).toBeUndefined();
  });

  it('should rank a lone player first without a gap to the next', async () => {
    const group = await started();
    const olena = await player(group.id, 'Olena', [0, 1]);
    const result = await service.standings(asMember(olena.id, group.id), group.id);
    expect(result.items).toEqual([expect.objectContaining({ memberId: olena.id, points: 20, rank: 1, mine: true })]);
    expect(result.me).toEqual({ rank: 1, points: 20 });
  });

  it('should order by points, share equal places and tell the gap to the next place up', async () => {
    const group = await started();
    const anna = await player(group.id, 'Anna', [0, 1, 2]);
    const boris = await player(group.id, 'Boris', [0, 1]);
    const clara = await player(group.id, 'Clara', [0, 1]);
    const dmytro = await player(group.id, 'Dmytro', []);
    const result = await service.standings(asMember(dmytro.id, group.id), group.id);
    expect(result.items.map((i) => [i.displayName, i.points, i.rank])).toEqual([
      ['Anna', 30, 1],
      ['Boris', 20, 2],
      ['Clara', 20, 2],
      ['Dmytro', 0, 4],
    ]);
    expect(result.me).toEqual({ rank: 4, points: 0, toNext: 20 });
    const second = await service.standings(asMember(clara.id, group.id), group.id);
    expect(second.me).toEqual({ rank: 2, points: 20, toNext: 10 });
    expect(anna.id).toBeDefined();
    expect(boris.id).toBeDefined();
  });

  it('should not score a hidden photo', async () => {
    const group = await started();
    const olena = await player(group.id, 'Olena', [0]);
    await repos.submissions.put(aSubmission(group.id, 1, olena.id, { status: 'hidden' }), null);
    const result = await service.standings(asMember(olena.id, group.id), group.id);
    expect(result.items[0].points).toBe(10);
  });

  it('should leave out removed and pending members', async () => {
    const group = await started();
    const olena = await player(group.id, 'Olena', [0]);
    await player(group.id, 'Gone', [0, 1], { status: 'removed' });
    await player(group.id, 'Waiting', [], { status: 'pending' });
    const result = await service.standings(asMember(olena.id, group.id), group.id);
    expect(result.items.map((i) => i.displayName)).toEqual(['Olena']);
  });

  it('should not list an organizer who does not play and give them no place', async () => {
    const group = await started();
    await player(group.id, 'Olena', [0]);
    const result = await service.standings(ownerSubject, group.id);
    expect(result.items).toHaveLength(1);
    expect(result.me).toBeUndefined();
  });

  it('should rank an organizer who plays', async () => {
    const group = await started();
    const organizer = await player(group.id, 'Owner', [0, 1], { isOrganizer: true, organizerUid: 'owner-1' });
    const result = await service.standings(ownerSubject, group.id);
    expect(result.me).toEqual({ rank: 1, points: 20 });
    expect(result.items[0]).toMatchObject({ memberId: organizer.id, mine: true });
  });
});
