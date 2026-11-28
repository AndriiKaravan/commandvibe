import { ForbiddenException } from '@nestjs/common';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { aCell, aGroup, aLike, aMember, aSubmission } from '../data/repositories.contract';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { PointsService } from './points.service';

describe('PointsService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let service: PointsService;
  let viewerMemberId: string | undefined;
  const subject = { kind: 'member' as const, id: 'viewer', groupId: 'g1' };
  const opens = (day: number) => new Date(Date.UTC(2026, 11, 1 + day, 7));

  beforeEach(async () => {
    repos = createMemoryRepositories();
    viewerMemberId = 'a';
    const group = aGroup({ id: 'g1' });
    await repos.groups.create(group);
    await repos.cells.replaceAll(
      'g1',
      [0, 1, 2].map((day) => aCell('g1', day, { state: 'open' })),
    );
    const now = () => new Date('2026-12-05T10:00:00Z');
    const groups = new GroupsService(repos.groups, repos.members, repos.organizers, now, 'https://app.test');
    jest.spyOn(groups, 'getFor').mockResolvedValue(group);
    const photos = { viewerOf: async () => ({ relation: 'member' as const, memberId: viewerMemberId }) };
    service = new PointsService(
      groups,
      photos as unknown as PhotosService,
      repos.members,
      repos.submissions,
      repos.cells,
      repos.likes,
    );
  });

  async function player(id: string, status: 'active' | 'removed' | 'pending' = 'active') {
    await repos.members.createUnique(aMember('g1', id, { id, status }));
  }
  async function photo(memberId: string, day: number, minutes: number, status: 'visible' | 'hidden' = 'visible') {
    await repos.submissions.put(
      aSubmission('g1', day, memberId, { submittedAt: new Date(opens(day).getTime() + minutes * 60_000), status }),
      null,
    );
  }

  describe('snapshot', () => {
    it('should add up the table for every active player', async () => {
      await player('a');
      await player('b');
      await photo('a', 0, 1);
      await photo('b', 0, 2);
      const { totals } = await service.snapshot('g1');

      expect(totals.get('a')).toBe(10 + 5 + 3);
      expect(totals.get('b')).toBe(10 + 3 + 3);
    });

    it('should count fans: different active players who liked a visible photo of the author', async () => {
      for (const id of ['a', 'b', 'c', 'd']) await player(id);
      await photo('a', 0, 1);
      await photo('a', 1, 1);
      for (const liker of ['b', 'c']) await repos.likes.add(aLike('g1', 0, 'a', liker));
      await repos.likes.add(aLike('g1', 1, 'a', 'b'));
      await repos.likes.add(aLike('g1', 1, 'a', 'a'));
      const { fans } = await service.snapshot('g1');

      expect(fans.get('a')).toBe(2);
      expect(fans.get('b') ?? 0).toBe(0);
    });

    it('should not count likes of removed members or on hidden photos as fans or points', async () => {
      await player('a');
      await player('b');
      await player('gone', 'removed');
      await photo('a', 0, 1);
      await photo('b', 0, 2, 'hidden');
      await repos.likes.add(aLike('g1', 0, 'a', 'gone'));
      await repos.likes.add(aLike('g1', 0, 'b', 'a'));
      const { fans, totals } = await service.snapshot('g1');

      expect(fans.get('a') ?? 0).toBe(0);
      expect(fans.get('b') ?? 0).toBe(0);
      expect(totals.get('b') ?? 0).toBe(0);
    });

    it('should read nothing for days that have not opened', async () => {
      await player('a');
      await repos.cells.replaceAll('g1', [aCell('g1', 0, { state: 'open' }), aCell('g1', 1, { state: 'closed' })]);
      const spy = jest.spyOn(repos.submissions, 'listByGroup');
      await service.snapshot('g1');

      expect(spy).toHaveBeenCalledWith('g1', 1);
    });
  });

  describe('lateness base', () => {
    it('should measure the day from when the door really opened, not from its schedule', async () => {
      await player('a');
      await repos.cells.replaceAll('g1', [
        aCell('g1', 0, { state: 'open', openedAt: new Date(opens(0).getTime() + 3 * 3_600_000) }),
      ]);
      await photo('a', 0, 26 * 60);
      const { entries } = await service.snapshot('g1');

      expect(entries.filter((e) => e.kind === 'late')).toEqual([]);
    });

    it('should fall back to the scheduled time for a day with no recorded opening', async () => {
      await player('a');
      await repos.cells.replaceAll('g1', [aCell('g1', 0, { state: 'open' })]);
      await photo('a', 0, 26 * 60);
      const { entries } = await service.snapshot('g1');

      expect(entries.filter((e) => e.kind === 'late')).toHaveLength(1);
    });
  });

  describe('journalFor', () => {
    it('should list only the viewer entries by day with a total', async () => {
      await player('a');
      await player('b');
      await photo('a', 0, 1);
      await photo('b', 0, 2);
      await photo('a', 1, 1);
      const journal = await service.journalFor(subject, 'g1');

      expect(journal.entries.every((e) => e.dayIndex === 0 || e.dayIndex === 1)).toBe(true);
      expect(journal.entries.map((e) => `${e.dayIndex}:${e.kind}`)).toEqual([
        '0:done',
        '0:speed',
        '0:goal',
        '1:done',
        '1:speed',
      ]);
      expect(journal.total).toBe(journal.entries.reduce((sum, e) => sum + e.amount, 0));
    });

    it('should be empty for a player with no photos', async () => {
      await player('a');
      expect(await service.journalFor(subject, 'g1')).toEqual({ total: 0, entries: [] });
    });

    it('should refuse someone who does not play', async () => {
      viewerMemberId = undefined;
      await expect(service.journalFor(subject, 'g1')).rejects.toThrow(new ForbiddenException('not_playing'));
    });
  });
});
