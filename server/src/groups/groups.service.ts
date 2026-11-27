import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CLOCK } from '../auth/session.service';
import { hashToken, newToken } from '../common/tokens';
import { Group, SessionSubject, defaultGroupSettings, nameKeyOf } from '../data/models';
import {
  GROUPS,
  GroupRepository,
  MEMBERS,
  MemberRepository,
  ORGANIZERS,
  OrganizerRepository,
} from '../data/repositories';

export const PUBLIC_APP_URL = Symbol('PUBLIC_APP_URL');

export interface CreateGroupInput {
  name: string;
  timezone: string;
  playsToo?: boolean;
  approveNew?: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  status: Group['status'];
  activeMembers: number;
  createdAt: Date;
}

export interface GroupWithInvite {
  group: Group;
  inviteUrl: string;
}

const maxGroupName = 60;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class GroupsService {
  constructor(
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(ORGANIZERS) private readonly organizers: OrganizerRepository,
    @Inject(CLOCK) private readonly now: () => Date,
    @Inject(PUBLIC_APP_URL) private readonly publicAppUrl: string,
  ) {}

  async create(ownerUid: string, input: CreateGroupInput): Promise<GroupWithInvite> {
    const name = (input.name ?? '').trim();
    if (!name || name.length > maxGroupName) {
      throw new BadRequestException('invalid_name');
    }
    if (typeof input.timezone !== 'string' || !isTimeZone(input.timezone)) {
      throw new BadRequestException('invalid_timezone');
    }
    const token = newToken();
    const group: Group = {
      id: randomBytes(10).toString('hex'),
      ownerUid,
      name,
      timezone: input.timezone,
      status: 'draft',
      settings: { ...defaultGroupSettings, approveNew: input.approveNew === true },
      inviteTokenHash: hashToken(token),
      inviteClosed: false,
      createdAt: this.now(),
    };
    await this.groups.create(group);
    if (input.playsToo !== false) {
      await this.addOrganizerAsMember(group);
    }
    return { group, inviteUrl: this.inviteUrl(token) };
  }

  async rotateInvite(ownerUid: string, groupId: string): Promise<GroupWithInvite> {
    const group = await this.owned(ownerUid, groupId);
    const token = newToken();
    await this.groups.update(groupId, { inviteTokenHash: hashToken(token), inviteClosed: false });
    return {
      group: { ...group, inviteTokenHash: hashToken(token), inviteClosed: false },
      inviteUrl: this.inviteUrl(token),
    };
  }

  async closeInvite(ownerUid: string, groupId: string): Promise<void> {
    await this.owned(ownerUid, groupId);
    await this.groups.update(groupId, { inviteClosed: true });
  }

  /** The organizer's own groups, newest first; only what a list screen needs. */
  async listOwned(ownerUid: string): Promise<GroupSummary[]> {
    const groups = await this.groups.listByOwner(ownerUid);
    groups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.all(
      groups.map(async (group) => ({
        id: group.id,
        name: group.name,
        status: group.status,
        activeMembers: (await this.members.list(group.id)).filter((member) => member.status === 'active').length,
        createdAt: group.createdAt,
      })),
    );
  }

  /** The group for its owner or one of its active members. */
  async getFor(subject: SessionSubject, groupId: string): Promise<Group> {
    const group = await this.groups.get(groupId);
    if (!group) {
      throw new NotFoundException();
    }
    if (subject.kind === 'organizer' && subject.id === group.ownerUid) {
      return group;
    }
    if (subject.kind === 'member' && subject.groupId === groupId) {
      const member = await this.members.get(groupId, subject.id);
      if (member?.status === 'active') {
        return group;
      }
    }
    throw new ForbiddenException();
  }

  /** The group if [ownerUid] owns it; throws otherwise. */
  async owned(ownerUid: string, groupId: string): Promise<Group> {
    const group = await this.groups.get(groupId);
    if (!group) {
      throw new NotFoundException();
    }
    if (group.ownerUid !== ownerUid) {
      throw new ForbiddenException();
    }
    return group;
  }

  private async addOrganizerAsMember(group: Group): Promise<void> {
    const organizer = await this.organizers.get(group.ownerUid);
    const displayName = (organizer?.displayName || organizer?.email.split('@')[0] || 'Organizer').trim().slice(0, 40);
    await this.members.createUnique({
      id: randomBytes(10).toString('hex'),
      groupId: group.id,
      displayName,
      nameKey: nameKeyOf(displayName),
      status: 'active',
      isOrganizer: true,
      organizerUid: group.ownerUid,
      createdAt: this.now(),
    });
  }

  private inviteUrl(token: string): string {
    return `${this.publicAppUrl}/j/${token}`;
  }
}
