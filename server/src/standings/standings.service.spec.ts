import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { aCell, aGroup, aLike, aMember, aSubmission } from '../data/repositories.contract';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { PointsService } from '../points/points.service';
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
  const opens = (day: number) => new Date(Date.UTC(2026, 11, 1 + day, 7));

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
    } as unknown as PhotosService;
    const points = new PointsService(groups, photos, repos.members, repos.submissions, repos.cells, repos.likes);
    service = new StandingsService(groups, photos, points, now);
  });

  /** Members are created with a fixed id so tests can name them; each day's photo is sent `minutes` after opening. */
  async function player(
    groupId: string,
    name: string,
    photos: { day: number; minutes: number; status?: 'visible' | 'hidden' }[],
    extra: Parameters<typeof aMember>[2] = {},
  ) {
    const member = aMember(groupId, name, { id: name.toLowerCase(), ...extra });
    await repos.members.createUnique(member);
    for (const { day, minutes, status } of photos) {
      await repos.submissions.put(
        aSubmission(groupId, day, member.id, {
          submittedAt: new Date(opens(day).getTime() + minutes * 60_000),
          status: status ?? 'visible',
        }),
        null,
      );
    }
    return member;
  }

  async function started() {
    const group = aGroup({ game });
    await repos.groups.create(group);
    await repos.cells.replaceAll(
      group.id,
      [0, 1, 2, 3, 4, 5, 6].map((day) => aCell(group.id, day, { state: 'open' })),
    );
    return group;
  }

  const asMember = (id: string, groupId: string) => ({ kind: 'member' as const, id, groupId });

  it('should return an empty list for a group nobody plays in', async () => {
    const group = await started();
    const result = await service.standings(ownerSubject, group.id);
    expect(result.items).toEqual([]);
    expect(result.me).toBeUndefined();
  });

  it('should score a lone player by the whole table: done, speed and the shared goal each day', async () => {
    const group = await started();
    const olena = await player(group.id, 'Olena', [
      { day: 0, minutes: 5 },
      { day: 1, minutes: 5 },
    ]);
    const result = await service.standings(asMember(olena.id, group.id), group.id);
    const perDay = 10 + 5 + 3;
    expect(result.items).toEqual([
      expect.objectContaining({ memberId: olena.id, points: 2 * perDay, rank: 1, mine: true, fans: 0 }),
    ]);
    expect(result.me).toEqual({ rank: 1, points: 2 * perDay });
  });

  it('should share a place between equal scores and tell the gap to the next place up', async () => {
    const group = await started();
    await player(group.id, 'Anna', [{ day: 0, minutes: 5 }]);
    await player(group.id, 'Boris', []);
    await player(group.id, 'Clara', []);
    const dmytro = await player(group.id, 'Dmytro', []);
    const result = await service.standings(asMember(dmytro.id, group.id), group.id);

    expect(result.items.map((i) => [i.displayName, i.points, i.rank])).toEqual([
      ['Anna', 15, 1],
      ['Boris', 0, 2],
      ['Clara', 0, 2],
      ['Dmytro', 0, 2],
    ]);
    expect(result.me).toEqual({ rank: 2, points: 0, toNext: 15 });
  });

  it('should not score a hidden photo', async () => {
    const group = await started();
    const olena = await player(group.id, 'Olena', [
      { day: 0, minutes: 5 },
      { day: 1, minutes: 5, status: 'hidden' },
    ]);
    const result = await service.standings(asMember(olena.id, group.id), group.id);
    expect(result.items[0].points).toBe(10 + 5 + 3);
  });

  it('should leave out removed and pending members', async () => {
    const group = await started();
    const olena = await player(group.id, 'Olena', [{ day: 0, minutes: 5 }]);
    await player(group.id, 'Gone', [{ day: 0, minutes: 1 }], { status: 'removed' });
    await player(group.id, 'Waiting', [], { status: 'pending' });
    const result = await service.standings(asMember(olena.id, group.id), group.id);
    expect(result.items.map((i) => i.displayName)).toEqual(['Olena']);
    expect(result.items[0].points).toBe(10 + 5 + 3);
  });

  it('should not list an organizer who does not play and give them no place', async () => {
    const group = await started();
    await player(group.id, 'Olena', [{ day: 0, minutes: 5 }]);
    const result = await service.standings(ownerSubject, group.id);
    expect(result.items).toHaveLength(1);
    expect(result.me).toBeUndefined();
  });

  it('should rank an organizer who plays', async () => {
    const group = await started();
    const organizer = await player(group.id, 'Owner', [{ day: 0, minutes: 5 }], {
      isOrganizer: true,
      organizerUid: 'owner-1',
    });
    const result = await service.standings(ownerSubject, group.id);
    expect(result.me).toEqual({ rank: 1, points: 18 });
    expect(result.items[0]).toMatchObject({ memberId: organizer.id, mine: true });
  });

  it('should add the spectators sympathy and show the fans', async () => {
    const group = await started();
    const anna = await player(group.id, 'Anna', [{ day: 0, minutes: 1 }]);
    const boris = await player(group.id, 'Boris', [{ day: 0, minutes: 2 }]);
    await repos.likes.add(aLike(group.id, 0, anna.id, boris.id));
    const result = await service.standings(asMember(boris.id, group.id), group.id);

    expect(result.items.map((i) => [i.displayName, i.points, i.fans])).toEqual([
      ['Anna', 10 + 5 + 3 + 5, 1],
      ['Boris', 10 + 3 + 3, 0],
    ]);
  });

  it('should read photos only for the days that have opened', async () => {
    const group = aGroup({ game });
    await repos.groups.create(group);
    const olena = await player(group.id, 'Olena', [{ day: 0, minutes: 5 }]);
    await repos.cells.replaceAll(group.id, [
      aCell(group.id, 0, { state: 'open' }),
      aCell(group.id, 1, { state: 'closed' }),
    ]);
    const spy = jest.spyOn(repos.submissions, 'listByGroup');
    await service.standings(asMember(olena.id, group.id), group.id);
    expect(spy).toHaveBeenCalledWith(group.id, 1);
  });
});
