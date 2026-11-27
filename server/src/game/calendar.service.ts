import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Category, categories } from '../content/task-catalog.model';
import { Cell, GameMode, GameSettings, Group, SessionSubject, TaskRef } from '../data/models';
import { CELLS, CellRepository, GROUPS, GroupRepository } from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { addDays, dayOpensAt, isValidDate, isValidTime, localDate } from './game-time';
import { RANDOM } from './game.tokens';
import { Random, autoPick, nextOther } from './task-picker';
import { CalendarView, DayView, calendarView, catalogById, dayView, isCategory } from './views';

export interface ConfigureInput {
  startDate: string;
  days: number;
  openTime?: string;
  mode: GameMode;
  categories: Category[];
}

export interface CustomTaskInput {
  title: { uk: string; en?: string };
  description: { uk: string; en?: string };
}

export interface SetTaskInput {
  taskId?: string;
  custom?: CustomTaskInput;
}

const minDays = 7;
const maxDays = 31;
const defaultOpenTime = '09:00';
const maxTitle = 60;
const maxDescription = 220;
const modes: GameMode[] = ['auto', 'roulette'];

const unprocessable = (code: string) => new UnprocessableEntityException(code);

function text(value: unknown, max: number, required: boolean): string | undefined {
  if (value === undefined && !required) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw unprocessable('invalid_custom');
  }
  const trimmed = value.trim();
  if ((required && trimmed.length === 0) || trimmed.length > max) {
    throw unprocessable('invalid_custom');
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

function localized(value: unknown, max: number): { uk: string; en?: string } {
  if (!value || typeof value !== 'object') {
    throw unprocessable('invalid_custom');
  }
  const { uk, en } = value as { uk?: unknown; en?: unknown };
  const english = text(en, max, false);
  return { uk: text(uk, max, true) as string, ...(english ? { en: english } : {}) };
}

function parseCustom(value: unknown): TaskRef {
  if (!value || typeof value !== 'object') {
    throw unprocessable('invalid_custom');
  }
  const { title, description } = value as { title?: unknown; description?: unknown };
  return { kind: 'custom', title: localized(title, maxTitle), description: localized(description, maxDescription) };
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly groupsService: GroupsService,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(CLOCK) private readonly now: () => Date,
    @Inject(RANDOM) private readonly random: Random,
  ) {}

  /** Sets up the game and draws the calendar; allowed until the first day opens. */
  async configure(ownerUid: string, groupId: string, input: ConfigureInput): Promise<CalendarView> {
    const group = await this.groupsService.owned(ownerUid, groupId);
    const game = this.parseGame(input ?? ({} as ConfigureInput), group);
    if ((await this.cells.list(groupId)).some((cell) => cell.state !== 'closed')) {
      throw new ConflictException('game_started');
    }
    const picks = autoPick(game, this.random);
    if (picks.length < game.days) {
      throw unprocessable('not_enough_tasks');
    }
    const cells: Cell[] = picks.map((task, dayIndex) => ({
      groupId,
      dayIndex,
      task,
      opensAt: dayOpensAt(game, dayIndex, group.timezone),
      state: 'closed',
    }));
    await this.cells.replaceAll(groupId, cells);
    await this.groups.update(groupId, { game });
    return calendarView(game, cells, true, this.now());
  }

  /** The calendar for the owner (every task) or an active member (open days only). */
  async calendar(subject: SessionSubject, groupId: string): Promise<CalendarView> {
    const group = await this.groupsService.getFor(subject, groupId);
    return calendarView(group.game, await this.cells.list(groupId), subject.kind === 'organizer', this.now());
  }

  /** The "Other" button: the next task from the same categories that the game does not use yet. */
  async other(ownerUid: string, groupId: string, day: number): Promise<DayView> {
    const { game, cell } = await this.closedDay(ownerUid, groupId, day);
    const used = await this.usedCatalogIds(groupId);
    const task = nextOther({ date: addDays(game.startDate, day), categories: game.categories, used }, this.random);
    if (!task) {
      throw new ConflictException('no_more_tasks');
    }
    return this.replaceTask(groupId, game, cell, task);
  }

  /** Puts a catalog task or one the organizer wrote on a day that has not opened. */
  async setTask(ownerUid: string, groupId: string, day: number, body: SetTaskInput): Promise<DayView> {
    const { game, cell } = await this.closedDay(ownerUid, groupId, day);
    let task: TaskRef;
    if (body?.taskId !== undefined) {
      if (typeof body.taskId !== 'string' || !catalogById.has(body.taskId)) {
        throw unprocessable('unknown_task');
      }
      const elsewhere = await this.usedCatalogIds(groupId, day);
      if (elsewhere.has(body.taskId)) {
        throw new ConflictException('task_in_game');
      }
      task = { kind: 'catalog', taskId: body.taskId };
    } else {
      task = parseCustom(body?.custom);
    }
    return this.replaceTask(groupId, game, cell, task);
  }

  /** Swaps the tasks of two days that have not opened. */
  async move(ownerUid: string, groupId: string, day: number, to: number): Promise<CalendarView> {
    const group = await this.groupsService.owned(ownerUid, groupId);
    const game = this.requireGame(group);
    if (!Number.isInteger(to) || to === day || to < 0 || to >= game.days) {
      throw unprocessable('invalid_day');
    }
    if (!(await this.cells.get(groupId, day))) {
      throw new BadRequestException('invalid_day');
    }
    const swapped = await this.cells.swapTasks(
      groupId,
      day,
      to,
      (a, b) => a.state === 'closed' && b.state === 'closed',
    );
    if (!swapped) {
      throw new ConflictException('day_opened');
    }
    return calendarView(game, await this.cells.list(groupId), true, this.now());
  }

  private parseGame(input: ConfigureInput, group: Group): GameSettings {
    const { startDate, days, mode } = input;
    if (typeof startDate !== 'string' || !isValidDate(startDate)) {
      throw unprocessable('invalid_date');
    }
    if (startDate < localDate(this.now(), group.timezone)) {
      throw unprocessable('start_in_past');
    }
    if (!Number.isInteger(days) || days < minDays || days > maxDays) {
      throw unprocessable('invalid_days');
    }
    const openTime = input.openTime ?? defaultOpenTime;
    if (typeof openTime !== 'string' || !isValidTime(openTime)) {
      throw unprocessable('invalid_time');
    }
    if (!modes.includes(mode)) {
      throw unprocessable('invalid_mode');
    }
    if (!Array.isArray(input.categories) || input.categories.length === 0 || !input.categories.every(isCategory)) {
      throw unprocessable('invalid_categories');
    }
    return { startDate, days, openTime, mode, categories: categories.filter((c) => input.categories.includes(c)) };
  }

  private requireGame(group: Group): GameSettings {
    if (!group.game) {
      throw new ConflictException('game_not_configured');
    }
    return group.game;
  }

  /** Owner's group, its game and a day that exists and has not opened. */
  private async closedDay(ownerUid: string, groupId: string, day: number): Promise<{ game: GameSettings; cell: Cell }> {
    const group = await this.groupsService.owned(ownerUid, groupId);
    const game = this.requireGame(group);
    const cell = await this.cells.get(groupId, day);
    if (!cell) {
      throw new BadRequestException('invalid_day');
    }
    if (cell.state !== 'closed') {
      throw new ConflictException('day_opened');
    }
    return { game, cell };
  }

  private async replaceTask(groupId: string, game: GameSettings, cell: Cell, task: TaskRef): Promise<DayView> {
    // The compare-and-set loses to a day that opened since we read it.
    if (!(await this.cells.transition(groupId, cell.dayIndex, 'closed', { task }))) {
      throw new ConflictException('day_opened');
    }
    return dayView({ ...cell, task }, game, true);
  }

  private async usedCatalogIds(groupId: string, exceptDay?: number): Promise<Set<string>> {
    const used = new Set<string>();
    for (const cell of await this.cells.list(groupId)) {
      if (cell.dayIndex !== exceptDay && cell.task.kind === 'catalog') {
        used.add(cell.task.taskId);
      }
    }
    return used;
  }
}
