import { catalog } from '../content/task-catalog';
import { Category, TaskCatalogEntry, isOfferedInMonth } from '../content/task-catalog.model';
import { TaskRef } from '../data/models';
import { addDays } from './game-time';

/** Uniform random in [0, 1); injected so tests can fix the draw. */
export type Random = () => number;

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const monthOf = (date: string): number => Number(date.slice(5, 7));

function pickOne(
  date: string,
  categories: Category[],
  used: Set<string>,
  random: Random,
): TaskCatalogEntry | undefined {
  const free = catalog.filter((task) => !used.has(task.id) && isOfferedInMonth(task, monthOf(date)));
  const preferred = free.filter((task) => task.categories.some((category) => categories.includes(category)));
  const pool = preferred.length > 0 ? preferred : free;
  return pool.length > 0 ? pool[Math.floor(random() * pool.length)] : undefined;
}

const catalogRef = (task: TaskCatalogEntry): TaskRef => ({ kind: 'catalog', taskId: task.id });

/** One distinct catalog task per day, from the chosen categories first and then from any task in season. */
export function autoPick(
  input: { startDate: string; days: number; categories: Category[] },
  random: Random,
): TaskRef[] {
  const used = new Set<string>();
  const picks: TaskRef[] = [];
  for (let day = 0; day < input.days; day++) {
    const task = pickOne(addDays(input.startDate, day), input.categories, used, random);
    if (!task) {
      break;
    }
    used.add(task.id);
    picks.push(catalogRef(task));
  }
  return picks;
}

/** The "Other" button: a task from the same categories that this game does not use yet. */
export function nextOther(
  input: { date: string; categories: Category[]; used: Set<string> },
  random: Random,
): TaskRef | undefined {
  const task = pickOne(input.date, input.categories, input.used, random);
  return task && catalogRef(task);
}
