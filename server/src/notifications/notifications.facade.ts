import { Injectable } from '@nestjs/common';
import { SessionSubject } from '../data/models';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { organizerKey } from './notification-kinds';
import { NotificationsPage, NotificationsService } from './notifications.service';

/** Resolves who the caller is in a group, then reads or marks their own entries. */
@Injectable()
export class NotificationsFacade {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    private readonly notifications: NotificationsService,
  ) {}

  list(subject: SessionSubject, groupId: string): Promise<NotificationsPage> {
    return this.keysOf(subject, groupId).then((keys) => this.notifications.list(groupId, keys));
  }

  async markRead(subject: SessionSubject, groupId: string, ids: string[] | undefined): Promise<void> {
    await this.notifications.markRead(groupId, await this.keysOf(subject, groupId), ids);
  }

  /** A member reads their own list; an organizer also reads the service entries under their account key. */
  private async keysOf(subject: SessionSubject, groupId: string): Promise<string[]> {
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    const keys = viewer.memberId ? [viewer.memberId] : [];
    return viewer.relation === 'owner' ? [...keys, organizerKey(group.ownerUid)] : keys;
  }
}
