import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Notification, NotificationKind } from '../data/models';
import {
  GROUPS,
  GroupRepository,
  MEMBERS,
  MemberRepository,
  NOTIFICATIONS,
  NotificationRepository,
} from '../data/repositories';
import { PushService } from '../shared/push';
import { maxNotificationsPerMember } from './notification-kinds';
import { NotificationDelivery } from './notification-sources';
import { accountIdsOfMember } from './push-account';
import { categoryOf, prefsOf } from './preferences';
import { inQuietHours, localDayStart } from './quiet-hours';

/** Impersonal pushes a person may get per local day; personal kinds are exempt. */
export const dailyPushCap = 3;

const personalKinds: readonly NotificationKind[] = ['my_turn', 'complaint', 'pending_member'];

const texts: Partial<Record<NotificationKind, { body: string; page: 'today' | 'feed' | 'me' }>> = {
  day_opened: { body: 'Відкрито нове завдання дня', page: 'today' },
  my_turn: { body: 'Твоя черга обирати завдання', page: 'today' },
  reminder: { body: 'Сьогодні ще чекає завдання', page: 'today' },
  comment: { body: 'Новий коментар до твого фото', page: 'feed' },
  pending_member: { body: 'Новий учасник чекає підтвердження', page: 'me' },
  complaint: { body: 'Є скарга на фото', page: 'me' },
};

/** Decides whether a recorded entry also becomes a push, and sends it. Never throws. */
@Injectable()
export class PushNotifier implements NotificationDelivery {
  private readonly log = new Logger(PushNotifier.name);

  constructor(
    private readonly push: PushService,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationRepository,
    @Inject(CLOCK) private readonly clock: () => Date,
  ) {}

  async deliver(groupId: string, entry: Notification): Promise<void> {
    try {
      await this.send(groupId, entry);
    } catch (error) {
      this.log.warn(`push not sent: ${error instanceof Error ? error.name : 'unknown'}`);
    }
  }

  private async send(groupId: string, entry: Notification): Promise<void> {
    const text = texts[entry.kind];
    const group = await this.groups.get(groupId);
    const accounts = text && group ? await this.accountsFor(group.ownerUid, entry) : [];
    const now = this.clock();
    if (!text || !group || accounts.length === 0 || inQuietHours(now, group.timezone)) {
      return;
    }
    if (!personalKinds.includes(entry.kind) && (await this.pushedToday(entry, group.timezone, now)) >= dailyPushCap) {
      return;
    }
    const report = await this.push.sendToUsers(accounts, {
      notification: { title: 'CommandVibe', body: text.body },
      data: { route: `/g/${groupId}/${text.page}`, kind: entry.kind },
    });
    if (report.sent > 0) {
      await this.notifications.put({ ...entry, pushedAt: now });
    }
  }

  /** Accounts whose devices should get the push; empty when the addressee opted out or left. */
  private async accountsFor(ownerUid: string, entry: Notification): Promise<string[]> {
    if (entry.memberId.startsWith('org:')) {
      return categoryOf(entry.kind) === 'service' ? [`o:${ownerUid}`] : [];
    }
    const member = await this.members.get(entry.groupId, entry.memberId);
    if (member?.status !== 'active') {
      return [];
    }
    const category = categoryOf(entry.kind);
    if (category !== 'service' && !prefsOf(member)[category]) {
      return [];
    }
    return accountIdsOfMember(member);
  }

  private async pushedToday(entry: Notification, timeZone: string, now: Date): Promise<number> {
    const start = localDayStart(now, timeZone).getTime();
    const recent = await this.notifications.list(entry.groupId, entry.memberId, maxNotificationsPerMember);
    return recent.filter((n) => n.pushedAt && n.pushedAt.getTime() >= start && !personalKinds.includes(n.kind)).length;
  }
}
