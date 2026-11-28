import { NotificationKind } from '../data/models';

/** Entries kept per member; older ones are dropped on every new record. */
export const maxNotificationsPerMember = 200;

/** Kinds only the organizer receives, addressed to the organizer account when they do not play. */
export const organizerKinds: readonly NotificationKind[] = ['pending_member', 'complaint'];

/** The bell list key of a non-playing organizer. */
export const organizerKey = (uid: string): string => `org:${uid}`;
