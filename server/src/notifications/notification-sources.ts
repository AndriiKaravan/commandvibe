import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Member, Notification } from '../data/models';
import {
  GROUPS,
  GroupRepository,
  LIKES,
  LikeRepository,
  MEMBERS,
  MemberRepository,
  NOTIFICATIONS,
  NotificationRepository,
} from '../data/repositories';
import { organizerKey } from './notification-kinds';
import { NotificationSink } from './notification-sink';
import { NewNotification, NotificationsService } from './notifications.service';

/** Delivers a recorded entry outside the app; set by PushNotifier. */
export interface NotificationDelivery {
  deliver(groupId: string, entry: Notification): Promise<void>;
}

export const NOTIFICATION_DELIVERY = Symbol('NotificationDelivery');

/**
 * Turns game events into bell entries for the right people. A failure here is logged
 * without data and never reaches the game action that caused it.
 */
@Injectable()
export class NotificationSources implements NotificationSink {
  private readonly log = new Logger(NotificationSources.name);

  constructor(
    private readonly notifications: NotificationsService,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(LIKES) private readonly likesRepo: LikeRepository,
    @Inject(NOTIFICATIONS) private readonly stored: NotificationRepository,
    @Optional() @Inject(NOTIFICATION_DELIVERY) private readonly delivery?: NotificationDelivery,
  ) {}

  dayOpened(groupId: string, dayIndex: number): Promise<void> {
    return this.toPlayers(groupId, { kind: 'day_opened', key: `day_${dayIndex}`, dayIndex });
  }

  photosRevealed(groupId: string, dayIndex: number): Promise<void> {
    return this.toPlayers(groupId, { kind: 'photos_revealed', key: `reveal_${dayIndex}`, dayIndex });
  }

  myTurn(groupId: string, dayIndex: number, memberId: string): Promise<void> {
    return this.safely(async () => {
      await this.record({ groupId, memberId, kind: 'my_turn', key: `turn_${dayIndex}`, dayIndex });
    });
  }

  comment(
    groupId: string,
    dayIndex: number,
    photoAuthorId: string,
    commenterId: string,
    commentId: string,
  ): Promise<void> {
    return this.safely(async () => {
      if (photoAuthorId === commenterId || !(await this.isActive(groupId, photoAuthorId))) {
        return;
      }
      await this.record({
        groupId,
        memberId: photoAuthorId,
        kind: 'comment',
        key: `comment_${commentId}`,
        dayIndex,
        actorMemberId: commenterId,
      });
    });
  }

  likes(groupId: string, dayIndex: number, photoAuthorId: string): Promise<void> {
    return this.safely(async () => {
      const [likes, members] = await Promise.all([
        this.likesRepo.listByDay(groupId, dayIndex),
        this.members.list(groupId),
      ]);
      const active = new Set(members.filter((m) => m.status === 'active').map((m) => m.id));
      if (!active.has(photoAuthorId)) {
        return;
      }
      const likers = new Set(
        likes
          .filter((l) => l.authorMemberId === photoAuthorId && l.likerMemberId !== photoAuthorId)
          .filter((l) => active.has(l.likerMemberId))
          .map((l) => l.likerMemberId),
      );
      const key = `likes_${dayIndex}`;
      const known = await this.stored.get(groupId, `${photoAuthorId}_${key}`);
      if (likers.size === 0 || likers.size <= (known?.count ?? 0)) {
        return;
      }
      await this.record({
        groupId,
        memberId: photoAuthorId,
        kind: 'likes',
        key,
        dayIndex,
        count: likers.size,
        upsert: true,
      });
    });
  }

  pendingMember(groupId: string, memberId: string): Promise<void> {
    return this.toOrganizer(groupId, { kind: 'pending_member', key: `pending_${memberId}`, actorMemberId: memberId });
  }

  complaint(groupId: string, dayIndex: number, photoAuthorId: string): Promise<void> {
    return this.toOrganizer(groupId, {
      kind: 'complaint',
      key: `complaint_${dayIndex}_${photoAuthorId}`,
      dayIndex,
      actorMemberId: photoAuthorId,
    });
  }

  private toPlayers(groupId: string, entry: Omit<NewNotification, 'groupId' | 'memberId'>): Promise<void> {
    return this.safely(async () => {
      const players: Member[] = (await this.members.list(groupId)).filter((m) => m.status === 'active');
      for (const player of players) {
        await this.record({ ...entry, groupId, memberId: player.id });
      }
    });
  }

  private toOrganizer(groupId: string, entry: Omit<NewNotification, 'groupId' | 'memberId'>): Promise<void> {
    return this.safely(async () => {
      const group = await this.groups.get(groupId);
      if (group) {
        await this.record({ ...entry, groupId, memberId: organizerKey(group.ownerUid), owner: true });
      }
    });
  }

  private async record(input: NewNotification): Promise<void> {
    const entry = await this.notifications.record(input);
    if (entry && this.delivery) {
      await this.delivery.deliver(input.groupId, entry);
    }
  }

  private async isActive(groupId: string, memberId: string): Promise<boolean> {
    return (await this.members.get(groupId, memberId))?.status === 'active';
  }

  private async safely(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.log.warn(`notification not recorded: ${error instanceof Error ? error.name : 'unknown'}`);
    }
  }
}
