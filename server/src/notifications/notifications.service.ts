import { Inject, Injectable } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Notification, NotificationKind } from '../data/models';
import { MEMBERS, MemberRepository, NOTIFICATIONS, NotificationRepository } from '../data/repositories';
import { PHOTO_EVENTS, PhotoEvents } from '../photos/photo-events';
import { maxNotificationsPerMember } from './notification-kinds';

export interface NewNotification {
  groupId: string;
  /** Addressee: a member id, or `org:<uid>` for a non-playing organizer. */
  memberId: string;
  kind: NotificationKind;
  /** Idempotency key within the addressee's list. */
  key: string;
  dayIndex?: number;
  actorMemberId?: string;
  count?: number;
  /** Replace an existing entry (and mark it unread again) instead of ignoring the repeat. */
  upsert?: boolean;
  /** Announce over the owner topic instead of the group topic. */
  owner?: boolean;
}

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  dayIndex?: number;
  actorName?: string;
  actorAvatar?: string;
  count?: number;
  createdAt: string;
  read: boolean;
}

export interface NotificationsPage {
  items: NotificationItem[];
  unread: number;
}

/** The server-stored bell list; pushes are decided elsewhere (see PushNotifier). */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(PHOTO_EVENTS) private readonly events: PhotoEvents,
    @Inject(CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  /** The stored entry, or undefined when an entry with this key already existed. */
  async record(input: NewNotification): Promise<Notification | undefined> {
    const entry: Notification = {
      id: `${input.memberId}_${input.key}`,
      groupId: input.groupId,
      memberId: input.memberId,
      kind: input.kind,
      createdAt: this.clock(),
      ...(input.dayIndex !== undefined && { dayIndex: input.dayIndex }),
      ...(input.actorMemberId && { actorMemberId: input.actorMemberId }),
      ...(input.count !== undefined && { count: input.count }),
    };
    if (input.upsert) {
      await this.notifications.put(entry);
    } else if (!(await this.notifications.addOnce(entry))) {
      return undefined;
    }
    await this.notifications.trim(input.groupId, input.memberId, maxNotificationsPerMember);
    const payload = { recipients: [input.memberId] };
    if (input.owner) {
      this.events.toOwner(input.groupId, 'notification.created', payload);
    } else {
      this.events.toGroup(input.groupId, 'notification.created', payload);
    }
    return entry;
  }

  /** Entries of all [keys] (a playing organizer has two), newest first. */
  async list(groupId: string, keys: string[]): Promise<NotificationsPage> {
    const [lists, members] = await Promise.all([
      Promise.all(keys.map((key) => this.notifications.list(groupId, key, maxNotificationsPerMember))),
      this.members.list(groupId),
    ]);
    const byId = new Map(members.map((member) => [member.id, member]));
    const entries = lists.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = entries.map((entry): NotificationItem => {
      const actor = entry.actorMemberId ? byId.get(entry.actorMemberId) : undefined;
      const named = actor && actor.status !== 'removed' ? actor : undefined;
      return {
        id: entry.id,
        kind: entry.kind,
        ...(entry.dayIndex !== undefined && { dayIndex: entry.dayIndex }),
        ...(named && { actorName: named.displayName }),
        ...(named?.avatar && { actorAvatar: named.avatar }),
        ...(entry.count !== undefined && { count: entry.count }),
        createdAt: entry.createdAt.toISOString(),
        read: entry.readAt !== undefined,
      };
    });
    return { items, unread: items.filter((item) => !item.read).length };
  }

  async markRead(groupId: string, keys: string[], ids: string[] | undefined): Promise<void> {
    const at = this.clock();
    await Promise.all(keys.map((key) => this.notifications.markRead(groupId, key, ids, at)));
    // Other devices of the same person refresh their bell.
    this.events.toGroup(groupId, 'notification.read', { recipients: keys });
    const service = keys.filter((key) => key.startsWith('org:'));
    if (service.length > 0) {
      this.events.toOwner(groupId, 'notification.read', { recipients: service });
    }
  }
}
