import { PointEntry, PointsInput, computePoints, dayMs, totalsOf } from './points-engine';

const day0 = new Date('2026-12-01T07:00:00Z');
const opensAt = new Map<number, Date>([
  [0, day0],
  [1, new Date(day0.getTime() + dayMs)],
  [2, new Date(day0.getTime() + 2 * dayMs)],
]);
const at = (ms: number) => new Date(day0.getTime() + ms);

function input(overrides: Partial<PointsInput> = {}): PointsInput {
  return {
    players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
    submissions: [],
    opensAt,
    likes: [],
    ...overrides,
  };
}

const sub = (memberId: string, dayIndex: number, submittedAt: Date, status: 'visible' | 'hidden' = 'visible') => ({
  memberId,
  dayIndex,
  submittedAt,
  status,
});
const of = (entries: PointEntry[], memberId: string, kind?: PointEntry['kind']) =>
  entries.filter((e) => e.memberId === memberId && (kind === undefined || e.kind === kind));
const sum = (entries: PointEntry[]) => entries.reduce((total, e) => total + e.amount, 0);

describe('computePoints', () => {
  describe('done', () => {
    it('should give 10 for a photo sent in time', () => {
      const entries = computePoints(input({ submissions: [sub('a', 0, at(60_000))] }));
      expect(of(entries, 'a', 'done')).toEqual([{ memberId: 'a', dayIndex: 0, kind: 'done', amount: 10 }]);
    });

    it('should give nothing to a member without a photo', () => {
      expect(computePoints(input({ submissions: [sub('a', 0, at(0))] })).filter((e) => e.memberId === 'b')).toEqual([]);
    });

    it('should give nothing for a hidden photo, a removed member or an unknown day', () => {
      const entries = computePoints(
        input({
          players: [{ id: 'a' }],
          submissions: [sub('a', 0, at(0), 'hidden'), sub('gone', 0, at(0)), sub('a', 9, at(0))],
        }),
      );
      expect(entries).toEqual([]);
    });
  });

  describe('late', () => {
    it('should still be in time exactly 24 hours after the door opened', () => {
      const entries = computePoints(input({ submissions: [sub('a', 0, at(dayMs))] }));
      expect(of(entries, 'a', 'late')).toEqual([]);
    });

    it('should charge 2 points for the first day of lateness, one millisecond past the limit', () => {
      const entries = computePoints(input({ submissions: [sub('a', 0, at(dayMs + 1))] }));
      expect(of(entries, 'a', 'late')).toEqual([{ memberId: 'a', dayIndex: 0, kind: 'late', amount: -2, detail: 1 }]);
      expect(sum(of(entries, 'a'))).toBe(8 + 0);
    });

    it('should charge 2 per day of lateness', () => {
      const entries = computePoints(input({ submissions: [sub('a', 0, at(3 * dayMs))] }));
      expect(of(entries, 'a', 'late')[0]).toMatchObject({ amount: -4, detail: 2 });
    });

    it('should never leave a late photo with less than 4 points', () => {
      const entries = computePoints(input({ submissions: [sub('a', 0, at(11 * dayMs))] }));
      const mine = of(entries, 'a');
      expect(of(entries, 'a', 'late')[0].amount).toBe(-6);
      expect(sum(mine.filter((e) => e.kind === 'done' || e.kind === 'late'))).toBe(4);
    });
  });

  describe('speed', () => {
    it('should reward the first three photos of the day with 5, 3 and 2', () => {
      const entries = computePoints(
        input({
          submissions: [sub('c', 0, at(3000)), sub('a', 0, at(1000)), sub('d', 0, at(4000)), sub('b', 0, at(2000))],
        }),
      );
      expect(of(entries, 'a', 'speed')).toEqual([{ memberId: 'a', dayIndex: 0, kind: 'speed', amount: 5, detail: 1 }]);
      expect(of(entries, 'b', 'speed')[0]).toMatchObject({ amount: 3, detail: 2 });
      expect(of(entries, 'c', 'speed')[0]).toMatchObject({ amount: 2, detail: 3 });
      expect(of(entries, 'd', 'speed')).toEqual([]);
    });

    it('should break a tie in time by member id', () => {
      const entries = computePoints(input({ submissions: [sub('b', 0, at(1000)), sub('a', 0, at(1000))] }));
      expect(of(entries, 'a', 'speed')[0].detail).toBe(1);
      expect(of(entries, 'b', 'speed')[0].detail).toBe(2);
    });

    it('should leave late and hidden photos out of the race', () => {
      const entries = computePoints(
        input({
          submissions: [sub('a', 0, at(dayMs + 5)), sub('b', 0, at(500), 'hidden'), sub('c', 0, at(9000))],
        }),
      );
      expect(of(entries, 'a', 'speed')).toEqual([]);
      expect(of(entries, 'b', 'speed')).toEqual([]);
      expect(of(entries, 'c', 'speed')[0].detail).toBe(1);
    });

    it('should run a separate race every day', () => {
      const entries = computePoints(
        input({ submissions: [sub('a', 0, at(1000)), sub('b', 1, new Date(opensAt.get(1)!.getTime() + 1000))] }),
      );
      expect(of(entries, 'a', 'speed')[0].detail).toBe(1);
      expect(of(entries, 'b', 'speed')[0].detail).toBe(1);
    });
  });

  describe('sympathy', () => {
    const like = (author: string, liker: string, dayIndex = 0) => ({
      dayIndex,
      authorMemberId: author,
      likerMemberId: liker,
    });

    it('should give 5 when everyone else liked the photo', () => {
      const entries = computePoints(
        input({
          submissions: [sub('a', 0, at(0))],
          likes: [like('a', 'b'), like('a', 'c'), like('a', 'd'), like('a', 'e')],
        }),
      );
      expect(of(entries, 'a', 'sympathy')).toEqual([
        { memberId: 'a', dayIndex: 0, kind: 'sympathy', amount: 5, detail: 4 },
      ]);
    });

    it('should scale with the share of the group and round down', () => {
      const entries = computePoints(
        input({ submissions: [sub('a', 0, at(0))], likes: [like('a', 'b'), like('a', 'c')] }),
      );
      expect(of(entries, 'a', 'sympathy')[0].amount).toBe(2);
    });

    it('should not divide by zero in a group of one and give nothing', () => {
      const entries = computePoints(
        input({ players: [{ id: 'a' }], submissions: [sub('a', 0, at(0))], likes: [like('a', 'a')] }),
      );
      expect(of(entries, 'a', 'sympathy')).toEqual([]);
    });

    it('should give the full 5 for a single like in a group of two', () => {
      const entries = computePoints(
        input({ players: [{ id: 'a' }, { id: 'b' }], submissions: [sub('a', 0, at(0))], likes: [like('a', 'b')] }),
      );
      expect(of(entries, 'a', 'sympathy')[0].amount).toBe(5);
    });

    it('should ignore a like from oneself, from a removed member, a repeated one and one on a hidden photo', () => {
      const entries = computePoints(
        input({
          submissions: [sub('a', 0, at(0)), sub('b', 0, at(1), 'hidden')],
          likes: [like('a', 'a'), like('a', 'gone'), like('a', 'c'), like('a', 'c'), like('b', 'c'), like('b', 'd')],
        }),
      );
      expect(of(entries, 'a', 'sympathy')[0]).toMatchObject({ amount: 1, detail: 1 });
      expect(of(entries, 'b', 'sympathy')).toEqual([]);
    });

    it('should count likes on a late photo too', () => {
      const entries = computePoints(
        input({
          submissions: [sub('a', 0, at(2 * dayMs))],
          likes: [like('a', 'b'), like('a', 'c'), like('a', 'd'), like('a', 'e')],
        }),
      );
      expect(of(entries, 'a', 'sympathy')[0].amount).toBe(5);
    });
  });

  describe('goal', () => {
    it('should add 3 to everyone who did the day once 80% of the group did', () => {
      const entries = computePoints(
        input({
          players: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })),
          submissions: ['a', 'b', 'c', 'd'].map((id, i) => sub(id, 0, at(i))),
        }),
      );
      expect(
        entries
          .filter((e) => e.kind === 'goal')
          .map((e) => e.memberId)
          .sort(),
      ).toEqual(['a', 'b', 'c', 'd']);
      expect(of(entries, 'a', 'goal')[0].amount).toBe(3);
      expect(of(entries, 'e', 'goal')).toEqual([]);
    });

    it('should add nothing below 80%', () => {
      const entries = computePoints(input({ submissions: ['a', 'b', 'c'].map((id, i) => sub(id, 0, at(i))) }));
      expect(entries.filter((e) => e.kind === 'goal')).toEqual([]);
    });

    it('should count a late completion towards the goal and reward it', () => {
      const entries = computePoints(
        input({
          submissions: [sub('a', 0, at(0)), sub('b', 0, at(1)), sub('c', 0, at(2)), sub('d', 0, at(2 * dayMs))],
        }),
      );
      expect(of(entries, 'd', 'goal')).toHaveLength(1);
    });

    it('should not count a hidden photo', () => {
      const entries = computePoints(
        input({
          submissions: [sub('a', 0, at(0)), sub('b', 0, at(1)), sub('c', 0, at(2)), sub('d', 0, at(3), 'hidden')],
        }),
      );
      expect(entries.filter((e) => e.kind === 'goal')).toEqual([]);
    });
  });

  describe('totals', () => {
    it('should add up the entries of each player', () => {
      const entries = computePoints(
        input({ players: [{ id: 'a' }, { id: 'b' }], submissions: [sub('a', 0, at(1)), sub('b', 0, at(2))] }),
      );
      const totals = totalsOf(entries);
      expect(totals.get('a')).toBe(10 + 5 + 3);
      expect(totals.get('b')).toBe(10 + 3 + 3);
    });

    it('should return nothing for nobody', () => {
      expect(computePoints(input({ players: [] }))).toEqual([]);
      expect(totalsOf([]).size).toBe(0);
    });
  });
});
