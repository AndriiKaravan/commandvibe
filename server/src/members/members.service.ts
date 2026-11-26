import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CLOCK, IssuedTokens, SessionService } from '../auth/session.service';
import { hashToken } from '../common/tokens';
import { Group, Member, nameKeyOf } from '../data/models';
import { GROUPS, GroupRepository, MEMBERS, MemberRepository, NameTakenError } from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { PinService } from './pin.service';

/** Side effects of membership changes; realtime implements it. */
export interface MemberEvents {
  joined(groupId: string, memberId: string, pending: boolean): void;
  approved(groupId: string, memberId: string): void;
  removed(groupId: string, memberId: string): void;
}

export const MEMBER_EVENTS = Symbol('MemberEvents');

export interface InvitePreview {
  groupName: string;
  memberCount: number;
  approveNew: boolean;
}

export type MemberView = Pick<Member, 'id' | 'groupId' | 'displayName' | 'status' | 'department' | 'avatar' | 'isOrganizer'>;

export function memberView(member: Member): MemberView {
  const { id, groupId, displayName, status, department, avatar, isOrganizer } = member;
  return { id, groupId, displayName, status, department, avatar, isOrganizer };
}

const maxName = 40;
const maxPinFailures = 5;
const pinLockSeconds = 15 * 60;

@Injectable()
export class MembersService {
  constructor(
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    private readonly groupsService: GroupsService,
    private readonly sessions: SessionService,
    private readonly pins: PinService,
    @Inject(MEMBER_EVENTS) private readonly events: MemberEvents,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  async preview(token: string): Promise<InvitePreview> {
    const group = await this.openGroup(token);
    const members = await this.members.list(group.id);
    return {
      groupName: group.name,
      memberCount: members.filter((m) => m.status === 'active').length,
      approveNew: group.settings.approveNew,
    };
  }

  async join(
    token: string,
    rawName: string,
    department: string | undefined,
    deviceInfo: string,
  ): Promise<IssuedTokens & { member: MemberView }> {
    const group = await this.openGroup(token);
    const displayName = this.validName(rawName);
    if (department !== undefined && department !== null && !group.settings.departments.includes(department)) {
      throw new UnprocessableEntityException('invalid_department');
    }
    const current = (await this.members.list(group.id)).filter((m) => m.status !== 'removed');
    if (current.length >= group.settings.memberLimit) {
      throw new UnprocessableEntityException('group_full');
    }
    const member = await this.createMember({
      id: randomBytes(10).toString('hex'),
      groupId: group.id,
      displayName,
      nameKey: nameKeyOf(displayName),
      department: department ?? undefined,
      status: group.settings.approveNew ? 'pending' : 'active',
      isOrganizer: false,
      createdAt: this.now(),
    });
    this.events.joined(group.id, member.id, member.status === 'pending');
    return { ...(await this.issue(member, deviceInfo)), member: memberView(member) };
  }

  async setPin(member: Pick<Member, 'id' | 'groupId'>, pin: string): Promise<void> {
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      throw new UnprocessableEntityException('pin_must_be_4_digits');
    }
    await this.members.updateSecrets(member.groupId, member.id, {
      pinHash: await this.pins.hash(pin),
      pinFailures: 0,
      lockedUntil: undefined,
    });
  }

  /** "I am already in the game": name + PIN on another device. */
  async returning(
    token: string,
    rawName: string,
    pin: string,
    deviceInfo: string,
  ): Promise<IssuedTokens & { member: MemberView }> {
    const group = await this.openGroup(token);
    const member = await this.members.findByName(group.id, nameKeyOf(String(rawName ?? '')));
    const secrets = member && member.status !== 'removed' ? await this.members.secrets(group.id, member.id) : undefined;
    if (!member || !secrets?.pinHash) {
      throw new UnauthorizedException({ code: 'no_such_login' });
    }
    const nowMs = this.now().getTime();
    if (secrets.lockedUntil && secrets.lockedUntil.getTime() > nowMs) {
      throw this.locked(secrets.lockedUntil.getTime() - nowMs);
    }
    // An expired lock starts a fresh series of attempts.
    const failures = secrets.lockedUntil ? 0 : secrets.pinFailures;
    if (!(await this.pins.verify(secrets.pinHash, String(pin ?? '')))) {
      const next = failures + 1;
      if (next >= maxPinFailures) {
        await this.members.updateSecrets(group.id, member.id, {
          pinFailures: next,
          lockedUntil: new Date(nowMs + pinLockSeconds * 1000),
        });
        throw this.locked(pinLockSeconds * 1000);
      }
      await this.members.updateSecrets(group.id, member.id, { pinFailures: next, lockedUntil: undefined });
      throw new UnauthorizedException({ code: 'wrong_pin', attemptsLeft: maxPinFailures - next });
    }
    await this.members.updateSecrets(group.id, member.id, { pinFailures: 0, lockedUntil: undefined });
    return { ...(await this.issue(member, deviceInfo)), member: memberView(member) };
  }

  async approve(ownerUid: string, groupId: string, memberId: string): Promise<void> {
    const member = await this.ownedMember(ownerUid, groupId, memberId);
    if (member.status === 'pending') {
      await this.members.update(groupId, memberId, { status: 'active' });
      this.events.approved(groupId, memberId);
    }
  }

  async remove(ownerUid: string, groupId: string, memberId: string): Promise<void> {
    await this.ownedMember(ownerUid, groupId, memberId);
    // Persist first: the realtime check reads the status when the socket reconnects.
    await this.members.update(groupId, memberId, { status: 'removed' });
    await this.sessions.revokeSubject(memberId);
    this.events.removed(groupId, memberId);
  }

  async resetPin(ownerUid: string, groupId: string, memberId: string): Promise<void> {
    await this.ownedMember(ownerUid, groupId, memberId);
    await this.members.updateSecrets(groupId, memberId, { pinHash: undefined, pinFailures: 0, lockedUntil: undefined });
  }

  async rename(ownerUid: string, groupId: string, memberId: string, rawName: string): Promise<void> {
    await this.ownedMember(ownerUid, groupId, memberId);
    const displayName = this.validName(rawName);
    try {
      await this.members.update(groupId, memberId, { displayName, nameKey: nameKeyOf(displayName) });
    } catch (error) {
      if (error instanceof NameTakenError) {
        throw new ConflictException('name_taken');
      }
      throw error;
    }
  }

  list(groupId: string): Promise<Member[]> {
    return this.members.list(groupId);
  }

  async member(groupId: string, memberId: string): Promise<Member> {
    const member = await this.members.get(groupId, memberId);
    if (!member) {
      throw new NotFoundException();
    }
    return member;
  }

  private async openGroup(token: string): Promise<Group> {
    const group = typeof token === 'string' && token ? await this.groups.findByInviteHash(hashToken(token)) : undefined;
    if (!group || group.inviteClosed) {
      throw new GoneException('invite_closed');
    }
    return group;
  }

  private validName(rawName: string): string {
    const displayName = String(rawName ?? '').trim().replace(/\s+/g, ' ');
    if (!displayName || displayName.length > maxName) {
      throw new UnprocessableEntityException('invalid_name');
    }
    return displayName;
  }

  private async createMember(member: Member): Promise<Member> {
    try {
      return await this.members.createUnique(member);
    } catch (error) {
      if (error instanceof NameTakenError) {
        throw new ConflictException('name_taken');
      }
      throw error;
    }
  }

  private async ownedMember(ownerUid: string, groupId: string, memberId: string): Promise<Member> {
    await this.groupsService.owned(ownerUid, groupId);
    return this.member(groupId, memberId);
  }

  private issue(member: Member, deviceInfo: string): Promise<IssuedTokens> {
    return this.sessions.issue({ kind: 'member', id: member.id, groupId: member.groupId }, deviceInfo ?? '');
  }

  private locked(remainingMs: number): HttpException {
    return new HttpException(
      { code: 'pin_locked', retryAfterSeconds: Math.ceil(remainingMs / 1000) },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
