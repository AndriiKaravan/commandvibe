import { Cell } from '../data/models';
import { Random, shuffle } from './task-picker';

/** Among [candidates], a random member of those who have been picker the fewest times (everyone gets a turn). */
export function pickPicker(candidates: string[], cells: Cell[], random: Random): string | undefined {
  if (candidates.length === 0) {
    return undefined;
  }
  const turns = new Map(candidates.map((id) => [id, 0]));
  for (const cell of cells) {
    if (cell.pickerMemberId && turns.has(cell.pickerMemberId)) {
      turns.set(cell.pickerMemberId, (turns.get(cell.pickerMemberId) ?? 0) + 1);
    }
  }
  const fewest = Math.min(...turns.values());
  const eligible = candidates.filter((id) => turns.get(id) === fewest);
  return eligible[Math.floor(random() * eligible.length)];
}

/** The wheel carries day numbers, never task titles: players must not see tasks of closed days. */
export function spinDoors(closedDays: number[], random: Random): { doors: number[]; winnerIndex: number } {
  const doors = shuffle(closedDays, random);
  return { doors, winnerIndex: Math.floor(random() * doors.length) };
}
