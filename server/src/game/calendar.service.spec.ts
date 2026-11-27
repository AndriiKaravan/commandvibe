import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { catalog } from '../content/task-catalog';
import { SessionSubject } from '../data/models';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { GroupsService } from '../groups/groups.service';
import { CalendarService, ConfigureInput } from './calendar.service';
import { GameEngine } from './game-engine';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const organizer = { uid: 'org-1', email: 'olena@example.com', displayName: 'Olena', createdAt: new Date() };
const ownerSubject: SessionSubject = { kind: 'organizer', id: 'org-1' };

describe('CalendarService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let service: CalendarService;
  let groupId: string;
  // 28 Nov 2026, 10:00 UTC = 12:00 in Kyiv.
  const now = new Date('2026-11-28T10:00:00Z');
  const input = (overrides: Partial<ConfigureInput> = {}): ConfigureInput => ({
    startDate: '2026-12-01',
    days: 14,
    mode: 'auto',
    categories: ['home'],
    ...overrides,
  });

  beforeEach(async () => {
    repos = createMemoryRepositories();
    await repos.organizers.upsert(organizer);
    const groups = new GroupsService(repos.groups, repos.members, repos.organizers, () => now, 'https://app.test');
    const engine = new GameEngine(
      groups,
      repos.groups,
      repos.cells,
      repos.members,
      { publish: () => undefined },
      seeded(2),
    );
    service = new CalendarService(groups, repos.groups, repos.cells, () => now, seeded(1), engine);
    groupId = (await groups.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv', playsToo: false })).group.id;
  });

  async function memberSubject(): Promise<SessionSubject> {
    const member = await repos.members.createUnique({
      id: 'a'.repeat(20),
      groupId,
      displayName: 'Ira',
      nameKey: 'ira',
      status: 'active',
      isOrganizer: false,
      createdAt: now,
    });
    return { kind: 'member', id: member.id, groupId };
  }

  describe('configure', () => {
    it('should store the game and one closed cell per day opening at openTime in the group zone', async () => {
      const view = await service.configure('org-1', groupId, input({ days: 10 }));
      expect(view.days).toHaveLength(10);
      expect(view.game).toMatchObject({ startDate: '2026-12-01', days: 10, openTime: '09:00', mode: 'auto' });
      expect(view.days[0]).toMatchObject({
        dayIndex: 0,
        date: '2026-12-01',
        state: 'closed',
        opensAt: '2026-12-01T07:00:00.000Z',
      });
      expect(view.days[9].date).toBe('2026-12-10');
      expect((await repos.groups.get(groupId))?.game?.days).toBe(10);
      expect(await repos.cells.list(groupId)).toHaveLength(10);
    });

    it('should accept today as the start date and a custom open time', async () => {
      const view = await service.configure('org-1', groupId, input({ startDate: '2026-11-28', openTime: '08:30' }));
      expect(view.days[0].opensAt).toBe('2026-11-28T06:30:00.000Z');
    });

    it.each([
      ['invalid_date', { startDate: '2026-02-30' }],
      ['invalid_date', { startDate: 'tomorrow' }],
      ['start_in_past', { startDate: '2026-11-27' }],
      ['invalid_days', { days: 6 }],
      ['invalid_days', { days: 32 }],
      ['invalid_days', { days: 7.5 }],
      ['invalid_days', { days: '10' as unknown as number }],
      ['invalid_time', { openTime: '25:00' }],
      ['invalid_mode', { mode: 'voting' as unknown as 'auto' }],
      ['invalid_categories', { categories: [] }],
      ['invalid_categories', { categories: ['nope' as unknown as 'home'] }],
    ])('should refuse %s', async (code, patch) => {
      await expect(service.configure('org-1', groupId, input(patch as Partial<ConfigureInput>))).rejects.toThrow(
        new UnprocessableEntityException(code),
      );
    });

    it('should refuse a non-owner', async () => {
      await expect(service.configure('someone-else', groupId, input())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow reconfiguring until the first day opens, then refuse', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      const again = await service.configure('org-1', groupId, input({ days: 9 }));
      expect(again.days).toHaveLength(9);
      await repos.cells.transition(groupId, 0, 'closed', { state: 'open', openedAt: now });
      await expect(service.configure('org-1', groupId, input())).rejects.toThrow(new ConflictException('game_started'));
    });
  });

  describe('calendar', () => {
    it('should show the owner every task and a member only the open ones', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await repos.cells.transition(groupId, 0, 'closed', { state: 'open', openedAt: now });
      const owner = await service.calendar(ownerSubject, groupId);
      expect(owner.days.every((day) => day.task !== undefined)).toBe(true);
      const member = await service.calendar(await memberSubject(), groupId);
      expect(member.days[0].task).toBeDefined();
      expect(member.days.slice(1).every((day) => !('task' in day))).toBe(true);
      expect(JSON.stringify(member.days.slice(1))).not.toMatch(/taskId|title|description/);
    });

    it('should hide the task of a day that is still being picked from members', async () => {
      await service.configure('org-1', groupId, input({ days: 7, mode: 'roulette' }));
      await repos.cells.transition(groupId, 0, 'closed', { state: 'picking' });
      const member = await service.calendar(await memberSubject(), groupId);
      expect(member.days[0]).not.toHaveProperty('task');
    });

    it('should return an empty calendar before the game is configured', async () => {
      const view = await service.calendar(ownerSubject, groupId);
      expect(view.game).toBeUndefined();
      expect(view.days).toEqual([]);
    });

    it('should refuse an outsider', async () => {
      await expect(
        service.calendar({ kind: 'member', id: 'x'.repeat(20), groupId: 'other' }, groupId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('other', () => {
    it('should replace only that day with a task the game does not use yet', async () => {
      const before = await service.configure('org-1', groupId, input({ days: 10 }));
      const after = await service.other('org-1', groupId, 3);
      const used = before.days.map((day) => day.task?.id);
      expect(after.task?.id).toBeDefined();
      expect(used).not.toContain(after.task?.id);
      const calendar = await service.calendar(ownerSubject, groupId);
      expect(calendar.days.map((day) => day.task?.id).filter((_, i) => i !== 3)).toEqual(
        used.filter((_, i) => i !== 3),
      );
    });

    it('should refuse a day that has opened', async () => {
      await service.configure('org-1', groupId, input());
      await repos.cells.transition(groupId, 2, 'closed', { state: 'open', openedAt: now });
      await expect(service.other('org-1', groupId, 2)).rejects.toThrow(new ConflictException('day_opened'));
    });

    it('should refuse a day outside the game', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await expect(service.other('org-1', groupId, 12)).rejects.toThrow(new BadRequestException('invalid_day'));
    });

    it('should say when the catalog has nothing new left', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      const every = (await repos.cells.list(groupId))[0];
      await repos.cells.replaceAll(
        groupId,
        catalog.map((task, i) => ({ ...every, dayIndex: i, task: { kind: 'catalog' as const, taskId: task.id } })),
      );
      await expect(service.other('org-1', groupId, 0)).rejects.toThrow(new ConflictException('no_more_tasks'));
    });
  });

  describe('setTask', () => {
    it('should put a catalog task on a day', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      const day = await service.setTask('org-1', groupId, 1, { taskId: 'snowman' });
      expect(day.task).toMatchObject({ id: 'snowman', custom: false, title: { en: 'Snowman' } });
    });

    it('should refuse an unknown task and a task already in the game', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await expect(service.setTask('org-1', groupId, 1, { taskId: 'no-such-task' })).rejects.toThrow(
        new UnprocessableEntityException('unknown_task'),
      );
      await service.setTask('org-1', groupId, 1, { taskId: 'snowman' });
      await expect(service.setTask('org-1', groupId, 2, { taskId: 'snowman' })).rejects.toThrow(
        new ConflictException('task_in_game'),
      );
    });

    it('should accept the same task on its own day again', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await service.setTask('org-1', groupId, 1, { taskId: 'snowman' });
      await expect(service.setTask('org-1', groupId, 1, { taskId: 'snowman' })).resolves.toBeDefined();
    });

    it('should accept a custom task with Ukrainian text only', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      const day = await service.setTask('org-1', groupId, 0, {
        custom: { title: { uk: ' Наш кіт ' }, description: { uk: 'Кіт у кадрі' } },
      });
      expect(day.task).toMatchObject({ custom: true, title: { uk: 'Наш кіт' }, description: { uk: 'Кіт у кадрі' } });
      expect(day.task?.id).toBeUndefined();
    });

    it.each([
      [{ custom: { title: { uk: '' }, description: { uk: 'x' } } }],
      [{ custom: { title: { uk: 'x'.repeat(61) }, description: { uk: 'x' } } }],
      [{ custom: { title: { uk: 'x' }, description: { uk: 'x'.repeat(221) } } }],
      [{ custom: { title: { uk: 'x' }, description: { uk: '  ' } } }],
      [{ custom: { title: { uk: 'x', en: 5 }, description: { uk: 'x' } } }],
      [{ custom: 'text' }],
      [{}],
    ])('should refuse an invalid custom task %j', async (body) => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await expect(service.setTask('org-1', groupId, 0, body as never)).rejects.toThrow(
        new UnprocessableEntityException('invalid_custom'),
      );
    });

    it('should refuse a day that has opened', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await repos.cells.transition(groupId, 0, 'closed', { state: 'open', openedAt: now });
      await expect(service.setTask('org-1', groupId, 0, { taskId: 'snowman' })).rejects.toThrow(
        new ConflictException('day_opened'),
      );
    });
  });

  describe('move', () => {
    it('should swap the tasks of two days and nothing else', async () => {
      const before = await service.configure('org-1', groupId, input({ days: 7 }));
      const after = await service.move('org-1', groupId, 2, 5);
      const ids = (view: typeof before) => view.days.map((day) => day.task?.id);
      const expected = ids(before);
      [expected[2], expected[5]] = [expected[5], expected[2]];
      expect(ids(after)).toEqual(expected);
    });

    it('should refuse when either day has opened', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await repos.cells.transition(groupId, 5, 'closed', { state: 'open', openedAt: now });
      await expect(service.move('org-1', groupId, 2, 5)).rejects.toThrow(new ConflictException('day_opened'));
    });

    it('should refuse a target outside the game or the same day', async () => {
      await service.configure('org-1', groupId, input({ days: 7 }));
      await expect(service.move('org-1', groupId, 2, 9)).rejects.toThrow(
        new UnprocessableEntityException('invalid_day'),
      );
      await expect(service.move('org-1', groupId, 2, 2)).rejects.toThrow(
        new UnprocessableEntityException('invalid_day'),
      );
      await expect(service.move('org-1', groupId, 2, 1.5)).rejects.toThrow(
        new UnprocessableEntityException('invalid_day'),
      );
    });
  });
});
