import { catalog } from '../content/task-catalog';
import { isOfferedInMonth } from '../content/task-catalog.model';
import { TaskRef } from '../data/models';
import { autoPick, nextOther } from './task-picker';

/** Small seeded generator so a failing shuffle can be reproduced. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const byId = new Map(catalog.map((task) => [task.id, task]));
const taskOf = (ref: TaskRef) => {
  if (ref.kind !== 'catalog') {
    throw new Error('expected a catalog task');
  }
  return byId.get(ref.taskId)!;
};

describe('autoPick', () => {
  it('should pick one distinct catalog task per day', () => {
    const picks = autoPick({ startDate: '2026-12-01', days: 31, categories: ['home'] }, seeded(1));
    const ids = picks.map((ref) => taskOf(ref).id);
    expect(picks).toHaveLength(31);
    expect(new Set(ids).size).toBe(31);
  });

  it('should take only winter tasks for 31 winter days in December', () => {
    const picks = autoPick({ startDate: '2026-12-01', days: 31, categories: ['winter'] }, seeded(2));
    expect(picks.every((ref) => taskOf(ref).categories.includes('winter'))).toBe(true);
  });

  it('should never offer a summer task in December even when the category is narrow', () => {
    const picks = autoPick({ startDate: '2026-12-01', days: 31, categories: ['pair'] }, seeded(3));
    const tasks = picks.map(taskOf);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(31);
    expect(tasks.some((task) => task.categories.includes('summer'))).toBe(false);
    // Pair tasks come first; the rest is filled from any seasonal task.
    expect(tasks.filter((task) => task.categories.includes('pair')).length).toBeGreaterThanOrEqual(30);
  });

  it('should respect the season of each day when a game crosses into May', () => {
    const picks = autoPick({ startDate: '2027-04-28', days: 7, categories: ['summer'] }, seeded(4));
    const dates = ['2027-04-28', '2027-04-29', '2027-04-30', '2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04'];
    picks.forEach((ref, day) => {
      expect(isOfferedInMonth(taskOf(ref), Number(dates[day].slice(5, 7)))).toBe(true);
    });
    expect(picks.slice(0, 3).some((ref) => taskOf(ref).categories.includes('summer'))).toBe(false);
    expect(picks.slice(3).every((ref) => taskOf(ref).categories.includes('summer'))).toBe(true);
  });

  it('should differ between random sources', () => {
    const a = autoPick({ startDate: '2026-12-01', days: 7, categories: ['home'] }, seeded(5));
    const b = autoPick({ startDate: '2026-12-01', days: 7, categories: ['home'] }, seeded(6));
    expect(a).not.toEqual(b);
  });
});

describe('nextOther', () => {
  it('should return a task from the same categories that is not used yet', () => {
    const used = new Set(['desk-view', 'mug-story']);
    const ref = nextOther({ date: '2026-12-05', categories: ['office'], used }, seeded(7))!;
    const task = taskOf(ref);
    expect(used.has(task.id)).toBe(false);
    expect(task.categories).toContain('office');
  });

  it('should fall back to any seasonal task when the categories are exhausted', () => {
    const used = new Set(catalog.filter((task) => task.categories.includes('winter')).map((task) => task.id));
    const ref = nextOther({ date: '2026-12-05', categories: ['winter'], used }, seeded(8))!;
    const task = taskOf(ref);
    expect(used.has(task.id)).toBe(false);
    expect(isOfferedInMonth(task, 12)).toBe(true);
  });

  it('should return undefined when nothing is left', () => {
    const used = new Set(catalog.map((task) => task.id));
    expect(nextOther({ date: '2026-12-05', categories: ['home'], used }, seeded(9))).toBeUndefined();
  });
});
