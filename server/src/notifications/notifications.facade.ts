import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SessionSubject } from '../data/models';
import { MEMBERS, MemberRepository } from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { organizerKey } from './notification-kinds';
import { NotificationPrefs, prefsOf } from './preferences';
import { NotificationsPage, NotificationsService } from './notifications.service';

/** Resolves who the caller is in a group, then reads or marks their own entries. */
@Injectable()
export class NotificationsFacade {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    private readonly notifications: NotificationsService,
    @Inject(MEMBERS) private readonly members: MemberRepository,
  ) {}

  list(subject: SessionSubject, groupId: string): Promise<NotificationsPage> {
    return this.keysOf(subject, groupId).then((keys) => this.notifications.list(groupId, keys));
  }

  async markRead(subject: SessionSubject, groupId: string, ids: string[] | undefined): Promise<void> {
    await this.notifications.markRead(groupId, await this.keysOf(subject, groupId), ids);
  }

  async settings(subject: SessionSubject, groupId: string): Promise<NotificationPrefs & { playing: boolean }> {
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    const member = viewer.memberId ? await this.members.get(groupId, viewer.memberId) : undefined;
    return { ...prefsOf(member ?? {}), playing: member !== undefined };
  }

  async setSettings(subject: SessionSubject, groupId: string, body: unknown): Promise<void> {
    const patch = body as { tasks?: unknown; social?: unknown } | null;
    const tasks = patch?.tasks;
    const social = patch?.social;
    const valid = (value: unknown) => value === undefined || typeof value === 'boolean';
    if (!valid(tasks) || !valid(social) || (tasks === undefined && social === undefined)) {
      throw new BadRequestException('invalid_settings');
    }
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    const member = viewer.memberId ? await this.members.get(groupId, viewer.memberId) : undefined;
    if (!member) {
      throw new ForbiddenException('not_playing');
    }
    const current = prefsOf(member);
    await this.members.update(groupId, member.id, {
      notify: {
        tasks: (tasks as boolean | undefined) ?? current.tasks,
        social: (social as boolean | undefined) ?? current.social,
      },
    });
  }

  /** A member reads their own list; an organizer also reads the service entries under their account key. */
  private async keysOf(subject: SessionSubject, groupId: string): Promise<string[]> {
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    const keys = viewer.memberId ? [viewer.memberId] : [];
    return viewer.relation === 'owner' ? [...keys, organizerKey(group.ownerUid)] : keys;
  }
}
