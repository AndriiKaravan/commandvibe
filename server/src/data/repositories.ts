import { Group, Member, MemberSecrets, Organizer, Session } from './models';

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
  /** Group whose current invite has this hash, closed or not. */
  findByInviteHash(hash: string): Promise<Group | undefined>;
}

/** Result of reserving one PIN attempt before the (slow) hash check. */
export type PinAttempt =
  | { kind: 'attempt'; attempt: number; pinHash: string | undefined }
  | { kind: 'locked'; lockedUntil: Date };

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

export const ORGANIZERS = Symbol('OrganizerRepository');
export const SESSIONS = Symbol('SessionRepository');
export const GROUPS = Symbol('GroupRepository');
export const MEMBERS = Symbol('MemberRepository');
