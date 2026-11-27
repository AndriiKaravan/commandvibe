import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SessionSubject } from '../data/models';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { GroupsService } from '../groups/groups.service';
import { CalendarService } from './calendar.service';
import { GameEngine } from './game-engine';
import { GameEvents } from './game-events';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

class RecordingEvents implements GameEvents {
  readonly log: { groupId: string; event: string; payload: Record<string, unknown> }[] = [];

  publish(groupId: string, event: string, payload: Record<string, unknown>): void {
    this.log.push({ groupId, event, payload });
  }

  of(event: string): Record<string, unknown>[] {
    return this.log.filter((entry) => entry.event === event).map((entry) => entry.payload);
  }

  names(): string[] {
    return this.log.map((entry) => entry.event);
  }
}

const at = (iso: string) => new Date(iso);
const organizer = { uid: 'org-1', email: 'olena@example.com', displayName: 'Olena', createdAt: new Date() };
const ownerSubject: SessionSubject = { kind: 'organizer', id: 'org-1' };

describe('GameEngine', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let groupsService: GroupsService;
  let calendar: CalendarService;
  let engine: GameEngine;
  let events: RecordingEvents;
  let groupId: string;
  let now: Date;

  beforeEach(async () => {
    now = at('2026-11-28T10:00:00Z');
    repos = createMemoryRepositories();
    events = new RecordingEvents();
    await repos.organizers.upsert(organizer);
    groupsService = new GroupsService(repos.groups, repos.members, repos.organizers, () => now, 'https://app.test');
    engine = new GameEngine(groupsService, repos.groups, repos.cells, repos.members, events, seeded(3));
    calendar = new CalendarService(groupsService, repos.groups, repos.cells, () => now, seeded(1), engine);
    groupId = (await groupsService.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv', playsToo: false })).group
      .id;
  });

  const setup = (mode: 'auto' | 'roulette', days = 7, startDate = '2026-12-01') =>
    calendar.configure('org-1', groupId, { startDate, days, mode, categories: ['home'] });

  async function addMember(id: string, status: 'active' | 'pending' | 'removed' = 'active'): Promise<SessionSubject> {
    await repos.members.createUnique({
      id,
      groupId,
      displayName: id,
      nameKey: id,
      status,
      isOrganizer: false,
      createdAt: now,
    });
    return { kind: 'member', id, groupId };
  }

  const stateOf = async (day: number) => (await repos.cells.get(groupId, day))?.state;

  describe('auto mode', () => {
    it('should open day 0 at openTime in the group zone, once, and activate the group', async () => {
      await setup('auto');
      await engine.advance(groupId, at('2026-12-01T06:59:00Z'));
      expect(events.names()).toEqual([]);
      expect(await stateOf(0)).toBe('closed');

      const opensAt = at('2026-12-01T07:00:00Z');
      await engine.advance(groupId, opensAt);
      expect(events.of('day.opened')).toEqual([{ dayIndex: 0 }]);
      expect((await repos.cells.get(groupId, 0))?.openedAt).toEqual(opensAt);
      expect((await repos.groups.get(groupId))?.status).toBe('active');

      await engine.advance(groupId, at('2026-12-01T07:05:00Z'));
      expect(events.of('day.opened')).toHaveLength(1);
    });

    it('should publish one event when three advances run in parallel', async () => {
      await setup('auto');
      const when = at('2026-12-01T07:00:00Z');
      await Promise.all([engine.advance(groupId, when), engine.advance(groupId, when), engine.advance(groupId, when)]);
      expect(events.of('day.opened')).toEqual([{ dayIndex: 0 }]);
    });

    it('should open day 0 at once when the game starts today after openTime', async () => {
      now = at('2026-11-28T07:30:00Z');
      await setup('auto', 7, '2026-11-28');
      await engine.advance(groupId, now);
      expect(events.of('day.opened')).toEqual([{ dayIndex: 0 }]);
      expect(await stateOf(1)).toBe('closed');
    });

    it('should open every missed day in order after a gap without ticks', async () => {
      await setup('auto');
      await engine.advance(groupId, at('2026-12-03T08:00:00Z'));
      expect(events.of('day.opened')).toEqual([{ dayIndex: 0 }, { dayIndex: 1 }, { dayIndex: 2 }]);
      expect(await stateOf(3)).toBe('closed');
    });

    it('should do nothing before the game is configured', async () => {
      await engine.advance(groupId, at('2026-12-01T07:00:00Z'));
      expect(events.names()).toEqual([]);
    });
  });

  describe('roulette mode', () => {
    const opening = at('2026-12-01T07:00:00Z');

    it('should hand the day to an active member with three hours to spin', async () => {
      await setup('roulette');
      await addMember('m1');
      await addMember('m2');
      await addMember('m3', 'pending');
      await addMember('m4', 'removed');
      await engine.advance(groupId, opening);

      const cell = await repos.cells.get(groupId, 0);
      expect(cell?.state).toBe('picking');
      expect(['m1', 'm2']).toContain(cell?.pickerMemberId);
      expect(events.of('roulette.waiting')).toEqual([
        { dayIndex: 0, pickerMemberId: cell?.pickerMemberId, deadlineAt: '2026-12-01T10:00:00.000Z' },
      ]);
      await engine.advance(groupId, at('2026-12-01T07:01:00Z'));
      expect(events.of('roulette.waiting')).toHaveLength(1);
    });

    it('should let only the chosen member spin, with a synchronized wheel of day numbers', async () => {
      await setup('roulette');
      const m1 = await addMember('m1');
      const m2 = await addMember('m2');
      await engine.advance(groupId, opening);
      const before = (await calendar.calendar(ownerSubject, groupId)).days.map((day) => day.task?.id);
      const picker = (await repos.cells.get(groupId, 0))?.pickerMemberId;
      const [chosen, other] = picker === 'm1' ? [m1, m2] : [m2, m1];

      const spinTime = at('2026-12-01T07:00:30Z');
      await expect(engine.spin(other, groupId, spinTime)).rejects.toThrow(new ForbiddenException('not_your_turn'));
      await engine.spin(chosen, groupId, spinTime);

      const [spin] = events.of('roulette.spin') as {
        dayIndex: number;
        doors: number[];
        winnerIndex: number;
        startAt: string;
        durationMs: number;
        serverTime: string;
        by: string;
      }[];
      expect(spin).toMatchObject({
        dayIndex: 0,
        durationMs: 5000,
        by: 'member',
        startAt: '2026-12-01T07:00:31.500Z',
        serverTime: spinTime.toISOString(),
      });
      expect([...spin.doors].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(events.names()).toEqual(['roulette.waiting', 'roulette.spin', 'day.opened']);
      expect(await stateOf(0)).toBe('open');

      const winnerDay = spin.doors[spin.winnerIndex];
      const after = (await calendar.calendar(ownerSubject, groupId)).days.map((day) => day.task?.id);
      expect(after[0]).toBe(before[winnerDay]);
      expect(after[winnerDay]).toBe(before[0]);
    });

    it('should refuse a spin when nothing is being picked', async () => {
      await setup('roulette');
      const m1 = await addMember('m1');
      await expect(engine.spin(m1, groupId, at('2026-12-01T06:00:00Z'))).rejects.toThrow(
        new ConflictException('not_picking'),
      );
    });

    it('should refuse a spin at the deadline and let the game spin instead', async () => {
      await setup('roulette');
      const m1 = await addMember('m1');
      await engine.advance(groupId, opening);
      const deadline = at('2026-12-01T10:00:00Z');
      await expect(engine.spin(m1, groupId, deadline)).rejects.toThrow(new ConflictException('deadline_passed'));
      expect(await stateOf(0)).toBe('picking');

      await engine.advance(groupId, at('2026-12-01T09:59:59Z'));
      expect(await stateOf(0)).toBe('picking');
      await engine.advance(groupId, deadline);
      expect(await stateOf(0)).toBe('open');
      expect((await repos.cells.get(groupId, 0))?.spin?.by).toBe('game');
      expect(events.of('roulette.spin')).toHaveLength(1);
    });

    it('should produce a single spin when a member and the game race at the deadline', async () => {
      await setup('roulette');
      const m1 = await addMember('m1');
      await engine.advance(groupId, opening);
      const results = await Promise.allSettled([
        engine.spin(m1, groupId, at('2026-12-01T09:59:59Z')),
        engine.advance(groupId, at('2026-12-01T10:00:00Z')),
      ]);
      expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
      expect(events.of('roulette.spin')).toHaveLength(1);
      expect(events.of('day.opened')).toHaveLength(1);
      expect(await stateOf(0)).toBe('open');
    });

    it('should spin at once by the game when nobody can play', async () => {
      await setup('roulette');
      await engine.advance(groupId, opening);
      expect(events.names()).toEqual(['roulette.spin', 'day.opened']);
      expect((await repos.cells.get(groupId, 0))?.spin?.by).toBe('game');
    });

    it('should let an organizer who plays spin', async () => {
      const ownGroup = (await groupsService.create('org-1', { name: 'Own', timezone: 'Europe/Kyiv' })).group.id;
      await calendar.configure('org-1', ownGroup, {
        startDate: '2026-12-01',
        days: 7,
        mode: 'roulette',
        categories: ['home'],
      });
      await engine.advance(ownGroup, opening);
      expect((await repos.cells.get(ownGroup, 0))?.state).toBe('picking');
      await engine.spin(ownerSubject, ownGroup, at('2026-12-01T07:00:30Z'));
      expect((await repos.cells.get(ownGroup, 0))?.state).toBe('open');
    });

    it('should open older days by the game and give the roulette only to the latest one', async () => {
      await setup('roulette');
      await addMember('m1');
      await engine.advance(groupId, at('2026-12-03T08:00:00Z'));
      expect(events.of('roulette.spin').map((spin) => spin.dayIndex)).toEqual([0, 1]);
      expect(await stateOf(2)).toBe('picking');
      expect(events.of('roulette.waiting').map((waiting) => waiting.dayIndex)).toEqual([2]);
    });
  });

  describe('what players must not learn early', () => {
    it('should keep task details out of every event', async () => {
      await setup('roulette');
      const m1 = await addMember('m1');
      await engine.advance(groupId, at('2026-12-01T07:00:00Z'));
      await engine.spin(m1, groupId, at('2026-12-01T07:00:30Z'));
      expect(JSON.stringify(events.log)).not.toMatch(/taskId|title|description|"task"/);
    });

    it('should show the task only after the animation has ended', async () => {
      await setup('roulette');
      const m1 = await addMember('m1');
      await engine.advance(groupId, at('2026-12-01T07:00:00Z'));
      const picking = await engine.today(m1, groupId, at('2026-12-01T07:00:10Z'));
      expect(picking.day).toMatchObject({ state: 'picking', pickerMemberId: 'm1' });
      expect(picking.day).not.toHaveProperty('task');

      await engine.spin(m1, groupId, at('2026-12-01T07:00:30Z'));
      const spinning = await engine.today(m1, groupId, at('2026-12-01T07:00:35Z'));
      expect(spinning.day).toMatchObject({ state: 'open', spin: { by: 'member', durationMs: 5000 } });
      expect(spinning.day).not.toHaveProperty('task');
      expect(await calendar.calendar(m1, groupId)).toBeDefined();

      const done = await engine.today(m1, groupId, at('2026-12-01T07:00:36.500Z'));
      expect(done.day?.task).toBeDefined();
    });
  });

  describe('today', () => {
    it('should report each stage of the game', async () => {
      const m1 = await addMember('m1');
      expect((await engine.today(m1, groupId, at('2026-12-01T07:00:00Z'))).status).toBe('not_configured');

      await setup('auto');
      const before = await engine.today(m1, groupId, at('2026-12-01T06:00:00Z'));
      expect(before).toMatchObject({ status: 'before_start', day: { dayIndex: 0, state: 'closed' } });
      expect(before.day).not.toHaveProperty('task');

      const active = await engine.today(m1, groupId, at('2026-12-02T08:00:00Z'));
      expect(active).toMatchObject({ status: 'active', day: { dayIndex: 1, state: 'open' } });
      expect(active.day?.task).toBeDefined();
      expect(active.serverTime).toBe('2026-12-02T08:00:00.000Z');
    });

    it('should finish a day after the last one opened and say so once', async () => {
      await setup('auto');
      const m1 = await addMember('m1');
      const end = at('2026-12-08T07:00:00Z');
      await Promise.all([engine.advance(groupId, end), engine.advance(groupId, end), engine.advance(groupId, end)]);
      expect(events.of('game.finished')).toHaveLength(1);
      expect((await repos.groups.get(groupId))?.status).toBe('finished');
      expect((await engine.today(m1, groupId, end)).status).toBe('finished');
      await engine.advance(groupId, at('2026-12-09T07:00:00Z'));
      expect(events.of('game.finished')).toHaveLength(1);
    });

    it('should refuse someone outside the group', async () => {
      await setup('auto');
      await expect(
        engine.today({ kind: 'member', id: 'x', groupId: 'other' }, groupId, at('2026-12-01T07:00:00Z')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
