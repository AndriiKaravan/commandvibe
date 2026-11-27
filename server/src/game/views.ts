import { catalog } from '../content/task-catalog';
import { Category, TaskCatalogEntry, categories } from '../content/task-catalog.model';
import { Cell, CellState, GameSettings, RouletteSpin, TaskRef } from '../data/models';
import { addDays } from './game-time';

/** A task as clients see it; a catalog task keeps its id, a custom one has none. */
export interface TaskView {
  id?: string;
  title: { uk: string; en?: string };
  description: { uk: string; en?: string };
  categories?: Category[];
  custom: boolean;
}

export interface DayView {
  dayIndex: number;
  date: string;
  opensAt: string;
  state: CellState;
  /** Absent for a member until the day is open: players must not see tasks ahead. */
  task?: TaskView;
}

export interface CalendarView {
  game?: GameSettings;
  days: DayView[];
  /** Lets clients correct their clock before animating anything. */
  serverTime: string;
}

export interface SpinView {
  startAt: string;
  durationMs: number;
  /** Day numbers around the wheel; never task titles. */
  doors: number[];
  winnerIndex: number;
  by: RouletteSpin['by'];
}

export type TodayStatus = 'not_configured' | 'before_start' | 'active' | 'finished';

export interface TodayView {
  status: TodayStatus;
  game?: GameSettings;
  day?: DayView & { pickerMemberId?: string; pickDeadlineAt?: string; isMyTurn?: boolean; spin?: SpinView };
  serverTime: string;
}

export interface CatalogTaskView extends TaskView {
  difficulty: TaskCatalogEntry['difficulty'];
  place: TaskCatalogEntry['place'];
}

export const catalogById: ReadonlyMap<string, TaskCatalogEntry> = new Map(catalog.map((task) => [task.id, task]));

export function taskView(ref: TaskRef): TaskView {
  if (ref.kind === 'custom') {
    return { title: ref.title, description: ref.description, custom: true };
  }
  const entry = catalogById.get(ref.taskId);
  if (!entry) {
    return { id: ref.taskId, title: { uk: ref.taskId }, description: { uk: '' }, custom: false };
  }
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    categories: entry.categories,
    custom: false,
  };
}

export function dayView(cell: Cell, game: GameSettings, showTask: boolean): DayView {
  const view: DayView = {
    dayIndex: cell.dayIndex,
    date: addDays(game.startDate, cell.dayIndex),
    opensAt: cell.opensAt.toISOString(),
    state: cell.state,
  };
  if (showTask) {
    view.task = taskView(cell.task);
  }
  return view;
}

export function spinView(spin: RouletteSpin): SpinView {
  return {
    startAt: spin.startAt.toISOString(),
    durationMs: spin.durationMs,
    doors: spin.doors,
    winnerIndex: spin.winnerIndex,
    by: spin.by,
  };
}

/** Players learn a day's task once it is open and, after a roulette, once the wheel has stopped. */
export function taskVisibleToPlayers(cell: Cell, now: Date): boolean {
  if (cell.state !== 'open') {
    return false;
  }
  return !cell.spin || now.getTime() >= cell.spin.startAt.getTime() + cell.spin.durationMs;
}

export function calendarView(
  game: GameSettings | undefined,
  cells: Cell[],
  isOrganizer: boolean,
  now: Date,
): CalendarView {
  if (!game) {
    return { days: [], serverTime: now.toISOString() };
  }
  return {
    game,
    days: cells.map((cell) => dayView(cell, game, isOrganizer || taskVisibleToPlayers(cell, now))),
    serverTime: now.toISOString(),
  };
}

/** Catalog search for the organizer's picker: optional category and a free-text query in either language. */
export function searchCatalog(category: Category | undefined, query: string | undefined): CatalogTaskView[] {
  const needle = query?.trim().toLocaleLowerCase('uk');
  return catalog
    .filter((task) => !category || task.categories.includes(category))
    .filter(
      (task) =>
        !needle ||
        [task.title.uk, task.title.en, task.description.uk, task.description.en].some((text) =>
          text.toLocaleLowerCase('uk').includes(needle),
        ),
    )
    .map((task) => ({
      ...taskView({ kind: 'catalog', taskId: task.id }),
      difficulty: task.difficulty,
      place: task.place,
    }));
}

export const isCategory = (value: unknown): value is Category => categories.includes(value as Category);
