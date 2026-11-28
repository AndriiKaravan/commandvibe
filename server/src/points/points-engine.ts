/** The points table of the design (section 9); every row is a named constant so a rule change is one edit. */
export const dayMs = 24 * 60 * 60 * 1000;
export const basePoints = 10;
export const speedBonus: readonly number[] = [5, 3, 2];
export const lateStep = 2;
export const lateFloor = 4;
export const sympathyMax = 5;
export const goalShare = 0.8;
export const goalBonus = 3;

export type PointKind = 'done' | 'speed' | 'late' | 'sympathy' | 'goal';

export interface PointEntry {
  memberId: string;
  dayIndex: number;
  kind: PointKind;
  amount: number;
  /** Place 1–3 for `speed`, days late for `late`, number of likes for `sympathy`. */
  detail?: number;
}

export interface PointsInput {
  /** Active players only; everyone else is ignored wherever they appear. */
  players: { id: string }[];
  /** `submittedAt` is the first upload; a replacement keeps it. */
  submissions: { memberId: string; dayIndex: number; submittedAt: Date; status: 'visible' | 'hidden' }[];
  /** When each day's door opened. */
  opensAt: ReadonlyMap<number, Date>;
  likes: { dayIndex: number; authorMemberId: string; likerMemberId: string }[];
}

interface Valid {
  memberId: string;
  dayIndex: number;
  submittedAt: Date;
  daysLate: number;
}

/** Days of lateness: 0 up to and including 24 hours after the door opened, then one per started day. */
function daysLateOf(submittedAt: Date, opened: Date): number {
  const late = submittedAt.getTime() - (opened.getTime() + dayMs);
  return late <= 0 ? 0 : Math.ceil(late / dayMs);
}

/** The whole journal, recomputed from what is stored; nothing here is kept between calls. */
export function computePoints(input: PointsInput): PointEntry[] {
  const playerIds = new Set(input.players.map((player) => player.id));
  if (playerIds.size === 0) {
    return [];
  }
  const valid: Valid[] = input.submissions
    .filter((sub) => sub.status === 'visible' && playerIds.has(sub.memberId) && input.opensAt.has(sub.dayIndex))
    .map((sub) => ({
      memberId: sub.memberId,
      dayIndex: sub.dayIndex,
      submittedAt: sub.submittedAt,
      daysLate: daysLateOf(sub.submittedAt, input.opensAt.get(sub.dayIndex)!),
    }));
  const days = [...new Set(valid.map((sub) => sub.dayIndex))].sort((a, b) => a - b);
  const entries: PointEntry[] = [];

  for (const dayIndex of days) {
    const ofDay = valid.filter((sub) => sub.dayIndex === dayIndex);
    for (const sub of ofDay) {
      entries.push({ memberId: sub.memberId, dayIndex, kind: 'done', amount: basePoints });
      if (sub.daysLate > 0) {
        const lost = basePoints - Math.max(lateFloor, basePoints - lateStep * sub.daysLate);
        entries.push({ memberId: sub.memberId, dayIndex, kind: 'late', amount: -lost, detail: sub.daysLate });
      }
    }
    const race = ofDay
      .filter((sub) => sub.daysLate === 0)
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime() || (a.memberId < b.memberId ? -1 : 1));
    race.slice(0, speedBonus.length).forEach((sub, place) => {
      entries.push({ memberId: sub.memberId, dayIndex, kind: 'speed', amount: speedBonus[place], detail: place + 1 });
    });
    if (ofDay.length / playerIds.size >= goalShare) {
      for (const sub of ofDay) {
        entries.push({ memberId: sub.memberId, dayIndex, kind: 'goal', amount: goalBonus });
      }
    }
    if (playerIds.size >= 2) {
      for (const sub of ofDay) {
        const likers = new Set(
          input.likes
            .filter(
              (like) =>
                like.dayIndex === dayIndex &&
                like.authorMemberId === sub.memberId &&
                like.likerMemberId !== sub.memberId &&
                playerIds.has(like.likerMemberId),
            )
            .map((like) => like.likerMemberId),
        );
        const amount = Math.min(sympathyMax, Math.floor((sympathyMax * likers.size) / (playerIds.size - 1)));
        if (amount > 0) {
          entries.push({ memberId: sub.memberId, dayIndex, kind: 'sympathy', amount, detail: likers.size });
        }
      }
    }
  }
  return entries;
}

export function totalsOf(entries: readonly PointEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.memberId, (totals.get(entry.memberId) ?? 0) + entry.amount);
  }
  return totals;
}
