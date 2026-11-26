/** Stored data shapes (design section 12); the client never sees them directly. */

export interface Organizer {
  uid: string;
  email: string;
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

export type GroupStatus = 'draft' | 'active' | 'finished';

export interface Group {
  id: string;
  ownerUid: string;
  name: string;
  timezone: string;
  status: GroupStatus;
  settings: GroupSettings;
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
