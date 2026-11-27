import { Cell } from '../data/models';
import { pickPicker, spinDoors } from './roulette';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const cellPickedBy = (day: number, pickerMemberId?: string): Cell => ({
  groupId: 'g',
  dayIndex: day,
  task: { kind: 'catalog', taskId: 'x' },
  opensAt: new Date(0),
  state: 'open',
  pickerMemberId,
});

describe('pickPicker', () => {
  it('should choose among the members who spun the least', () => {
    const cells = [cellPickedBy(0, 'a'), cellPickedBy(1, 'a'), cellPickedBy(2, 'b')];
    for (let seed = 1; seed <= 20; seed++) {
      expect(pickPicker(['a', 'b', 'c'], cells, seeded(seed))).toBe('c');
    }
  });

  it('should give everyone a turn before anyone gets a second one', () => {
    const cells: Cell[] = [];
    const turns: string[] = [];
    const random = seeded(11);
    for (let day = 0; day < 6; day++) {
      const picker = pickPicker(['a', 'b', 'c'], cells, random)!;
      turns.push(picker);
      cells.push(cellPickedBy(day, picker));
    }
    expect(new Set(turns.slice(0, 3)).size).toBe(3);
    expect(new Set(turns.slice(3, 6)).size).toBe(3);
  });

  it('should return undefined without candidates', () => {
    expect(pickPicker([], [], seeded(1))).toBeUndefined();
  });

  it('should ignore cells whose picker is not a candidate', () => {
    expect(pickPicker(['a'], [cellPickedBy(0, 'gone')], seeded(1))).toBe('a');
  });
});

describe('spinDoors', () => {
  it('should be a permutation of the closed days with a winner inside', () => {
    const { doors, winnerIndex } = spinDoors([3, 4, 5, 9], seeded(3));
    expect([...doors].sort((a, b) => a - b)).toEqual([3, 4, 5, 9]);
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(winnerIndex).toBeLessThan(doors.length);
  });

  it('should be able to land on every door', () => {
    const winners = new Set<number>();
    const random = seeded(4);
    for (let i = 0; i < 200; i++) {
      const { doors, winnerIndex } = spinDoors([1, 2, 3], random);
      winners.add(doors[winnerIndex]);
    }
    expect(winners).toEqual(new Set([1, 2, 3]));
  });
});
