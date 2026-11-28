import { Cell } from '../data/models';

/** How many days from the start can hold photos: up to the latest open one. */
export function openedDayCount(cells: readonly Cell[]): number {
  const open = cells.filter((cell) => cell.state === 'open').map((cell) => cell.dayIndex);
  return open.length ? Math.max(...open) + 1 : 0;
}
