import {
  Cell,
  CellState,
  Complaint,
  Group,
  GroupStatus,
  Member,
  MemberSecrets,
  Organizer,
  Session,
  Submission,
} from './models';

/** Thrown by [MemberRepository.createUnique] when the name is taken in the group. */
export class NameTakenError extends Error {
  constructor() {
    super('name_taken');
    this.name = 'NameTakenError';
  }
}

export interface OrganizerRepository {
  upsert(organizer: Organizer): Promise<void>;
  get(uid: string): Promise<Organizer | undefined>;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  update(id: string, patch: Partial<Omit<Session, 'id'>>): Promise<void>;
  /**
   * Replaces the refresh hash only if it still equals [expectedHash]; false when the
   * session is gone, revoked or the hash already moved on (a reuse or a lost race).
   */
  rotateRefresh(id: string, expectedHash: string, nextHash: string): Promise<boolean>;
  /** Revokes every open session of the subject (organizer uid or member id). */
  revokeAllFor(subjectId: string, at: Date): Promise<void>;
}

export interface GroupRepository {
  create(group: Group): Promise<void>;
  get(id: string): Promise<Group | undefined>;
  update(id: string, patch: Partial<Omit<Group, 'id'>>): Promise<void>;
  /** Atomic compare-and-set of the status: true only for the call that changed it. */
  setStatus(id: string, expected: GroupStatus, next: GroupStatus): Promise<boolean>;
  /** Groups that have a game and whose status is one of [statuses]; the Scheduler tick walks these. */
  listWithGame(statuses: GroupStatus[]): Promise<Group[]>;
  /** Group whose current invite has this hash, closed or not. */
  findByInviteHash(hash: string): Promise<Group | undefined>;
}

export interface CellRepository {
  /** Cells of the group ordered by day. */
  list(groupId: string): Promise<Cell[]>;
  get(groupId: string, dayIndex: number): Promise<Cell | undefined>;
  /** Drops every cell of the group and stores [cells] instead. */
  replaceAll(groupId: string, cells: Cell[]): Promise<void>;
  /**
   * Atomic compare-and-set: applies [patch] only while the cell is still in [expected].
   * A key patched with `undefined` is cleared. Returns whether this call won.
   */
  transition(
    groupId: string,
    dayIndex: number,
    expected: CellState,
    patch: Partial<Omit<Cell, 'groupId' | 'dayIndex'>>,
  ): Promise<boolean>;
  /**
   * Opens [day] through the roulette in one atomic step: applies [patch], and the task behind the winning
   * door [winnerDay] moves to [day] while [day]'s old task takes its place.
   * `lost` — [day] is no longer in [expected]; `retry` — the winning door has opened meanwhile, spin again; nothing changed in both.
   */
  openBySpin(
    groupId: string,
    day: number,
    expected: CellState,
    winnerDay: number,
    patch: Partial<Omit<Cell, 'groupId' | 'dayIndex' | 'task'>>,
  ): Promise<'won' | 'lost' | 'retry'>;
  /** Atomically swaps the tasks of two days when [onlyIf] accepts their current state. */
  swapTasks(groupId: string, a: number, b: number, onlyIf: (cellA: Cell, cellB: Cell) => boolean): Promise<boolean>;
  /** Compare-and-set: stamps `revealedAt` only while it is empty; true only for the winning call. */
  markRevealed(groupId: string, dayIndex: number, at: Date): Promise<boolean>;
}

export interface SubmissionRepository {
  get(groupId: string, dayIndex: number, memberId: string): Promise<Submission | undefined>;
  listDay(groupId: string, dayIndex: number): Promise<Submission[]>;
  /** Submissions of the member over days `0..days-1`. */
  listMember(groupId: string, memberId: string, days: number): Promise<Submission[]>;
  /**
   * Transaction: `null` creates only when absent; a version string replaces only while the stored version is the same.
   */
  put(submission: Submission, expectedVersion: string | null): Promise<'created' | 'replaced' | 'conflict'>;
  /** False when there is no such submission. Hiding stamps `hiddenAt`, restoring clears it. */
  setStatus(
    groupId: string,
    dayIndex: number,
    memberId: string,
    status: Submission['status'],
    at: Date,
  ): Promise<boolean>;
  delete(groupId: string, dayIndex: number, memberId: string): Promise<void>;
}

export interface ComplaintRepository {
  /** False when this complainer has already complained about this photo. */
  add(complaint: Complaint): Promise<boolean>;
  listOpen(groupId: string): Promise<Complaint[]>;
  openCount(groupId: string, dayIndex: number, authorMemberId: string): Promise<number>;
  /** Closes the open complaints of one photo; returns how many were closed. */
  resolve(groupId: string, dayIndex: number, authorMemberId: string, at: Date): Promise<number>;
  /** Removes complaints filed by or against the member. */
  deleteInvolving(groupId: string, memberId: string): Promise<void>;
}

/** Result of reserving one PIN attempt before the (slow) hash check. */
export type PinAttempt =
  { kind: 'attempt'; attempt: number; pinHash: string | undefined } | { kind: 'locked'; lockedUntil: Date };

export interface MemberRepository {
  /**
   * Atomically counts one PIN attempt: refuses while locked, starts a fresh
   * series after an expired lock, and sets the lock on attempt [max].
   * Parallel callers therefore get at most [max] attempts.
   */
  reservePinAttempt(groupId: string, id: string, now: Date, max: number, lockMs: number): Promise<PinAttempt>;
  /** Creates the member atomically with its name reservation. */
  createUnique(member: Member): Promise<Member>;
  get(groupId: string, id: string): Promise<Member | undefined>;
  findByName(groupId: string, nameKey: string): Promise<Member | undefined>;
  list(groupId: string): Promise<Member[]>;
  /** A renamed member keeps its old name until the new one is reserved; throws [NameTakenError]. */
  update(groupId: string, id: string, patch: Partial<Omit<Member, 'id' | 'groupId'>>): Promise<void>;
  secrets(groupId: string, id: string): Promise<MemberSecrets>;
  updateSecrets(groupId: string, id: string, patch: Partial<MemberSecrets>): Promise<void>;
}

export const CELLS = Symbol('CellRepository');
export const ORGANIZERS = Symbol('OrganizerRepository');
export const SESSIONS = Symbol('SessionRepository');
export const GROUPS = Symbol('GroupRepository');
export const MEMBERS = Symbol('MemberRepository');
export const SUBMISSIONS = Symbol('SubmissionRepository');
export const COMPLAINTS = Symbol('ComplaintRepository');
