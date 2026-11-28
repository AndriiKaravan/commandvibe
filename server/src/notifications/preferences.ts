import { Member, NotificationKind } from '../data/models';

export interface NotificationPrefs {
  /** New day, photo reveal, evening reminder, your turn. */
  tasks: boolean;
  /** Likes and comments on your photos. */
  social: boolean;
}

export const defaultPrefs: NotificationPrefs = { tasks: true, social: true };

export const prefsOf = (member: Pick<Member, 'notify'>): NotificationPrefs => ({
  ...defaultPrefs,
  ...member.notify,
});

/** Category a kind belongs to; service kinds for the organizer cannot be switched off. */
export function categoryOf(kind: NotificationKind): keyof NotificationPrefs | 'service' {
  switch (kind) {
    case 'day_opened':
    case 'photos_revealed':
    case 'reminder':
    case 'my_turn':
      return 'tasks';
    case 'likes':
    case 'comment':
      return 'social';
    case 'pending_member':
    case 'complaint':
      return 'service';
  }
}
