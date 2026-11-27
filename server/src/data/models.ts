/** Stored data shapes (design section 12); the client never sees them directly. */
import type { Category } from '../content/task-catalog.model';

export interface Organizer {
  uid: string;
  email: string;
  /** Name from the sign-in provider; the default name when the organizer plays too. */
  displayName?: string;
  createdAt: Date;
}

export type SubjectKind = 'organizer' | 'member';

export interface SessionSubject {
  kind: SubjectKind;
  /** Organizer uid or member id. */
  id: string;
  /** Group of a member session. */
  groupId?: string;
}

export interface Session {
  id: string;
  subject: SessionSubject;
  refreshTokenHash: string;
  deviceInfo: string;
  createdAt: Date;
  revokedAt?: Date;
}

export interface GroupSettings {
  approveNew: boolean;
  memberLimit: number;
  likesCountOnly: boolean;
  departments: string[];
}

export const defaultGroupSettings: GroupSettings = {
  approveNew: false,
  memberLimit: 50,
  likesCountOnly: false,
  departments: [],
};

export type GameMode = 'auto' | 'roulette';

/** How and when the group plays; set once by the organizer before the first day opens. */
export interface GameSettings {
  /** First day, YYYY-MM-DD in the group's time zone. */
  startDate: string;
  days: number;
  /** Local wall-clock time HH:mm at which each day opens. */
  openTime: string;
  mode: GameMode;
  categories: Category[];
}

export type GroupStatus = 'draft' | 'active' | 'finished';

export interface Group {
  id: string;
  ownerUid: string;
  name: string;
  timezone: string;
  status: GroupStatus;
  settings: GroupSettings;
  game?: GameSettings;
  inviteTokenHash: string;
  inviteClosed: boolean;
  createdAt: Date;
}

export type MemberStatus = 'pending' | 'active' | 'removed';

export interface Member {
  id: string;
  groupId: string;
  displayName: string;
  /** Normalised name that must be unique inside the group. */
  nameKey: string;
  avatar?: string;
  department?: string;
  status: MemberStatus;
  isOrganizer: boolean;
  /** Organizer uid when [isOrganizer]. */
  organizerUid?: string;
  createdAt: Date;
}

export interface MemberSecrets {
  pinHash?: string;
  pinFailures: number;
  lockedUntil?: Date;
}

export function nameKeyOf(displayName: string): string {
  return displayName.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk');
}

/** What a day asks for: a catalog task, or one the organizer wrote. */
export type TaskRef =
  | { kind: 'catalog'; taskId: string }
  | { kind: 'custom'; title: { uk: string; en?: string }; description: { uk: string; en?: string } };

export type CellState = 'closed' | 'picking' | 'open';

/** One roulette run; clients animate it from [startAt] so everyone sees the same wheel. */
export interface RouletteSpin {
  startAt: Date;
  durationMs: number;
  /** Day indexes around the wheel, in order. */
  doors: number[];
  winnerIndex: number;
  by: 'member' | 'game';
}

/** One door of the calendar (design section 12: `cells/{cellId}`). */
export interface Cell {
  groupId: string;
  dayIndex: number;
  task: TaskRef;
  opensAt: Date;
  state: CellState;
  openedAt?: Date;
  /** Member who has to spin today's roulette. */
  pickerMemberId?: string;
  pickDeadlineAt?: Date;
  spin?: RouletteSpin;
}
