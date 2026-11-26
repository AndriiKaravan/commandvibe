import { Inject, Injectable } from '@nestjs/common';
import { SessionService } from '../auth/session.service';
import { GROUPS, GroupRepository, MEMBERS, MemberRepository } from '../data/repositories';
import { MemberEvents } from '../members/members.service';
import { RealtimeOptions, RealtimeService, SessionInfo, VerifiedToken } from '../shared/realtime';

/** Group topic: everything members see. */
export const groupTopic = (groupId: string): string => `group:${groupId}`;
/** Owner topic: what only the organizer sees (pending members, complaints). */
export const ownerTopic = (groupId: string): string => `org:${groupId}`;
/** Personal topic: approval and other news for one member, readable even while pending. */
export const memberTopic = (memberId: string): string => `member:${memberId}`;

const topicPattern = /^(group|org|member):([a-f0-9]{20})$/;

@Injectable()
export class RealtimeAccess {
  constructor(
    private readonly sessions: SessionService,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
  ) {}

  async verifyToken(token: string): Promise<VerifiedToken> {
    const access = await this.sessions.verifyAccess(token);
    return {
      userId: access.subject.id,
      expiresAt: access.expiresAt,
      claims: { kind: access.subject.kind, groupId: access.subject.groupId },
    };
  }

  async authorizeSubscribe(session: SessionInfo, topic: string): Promise<boolean> {
    const match = topicPattern.exec(topic);
    if (!match) {
      return false;
    }
    const [, kind, id] = match;
    if (kind === 'member') {
      return session.claims.kind === 'member' && session.userId === id;
    }
    const groupId = id;
    const group = await this.groups.get(groupId);
    if (!group) {
      return false;
    }
    const isOwner = session.claims.kind === 'organizer' && session.userId === group.ownerUid;
    if (kind === 'org' || isOwner) {
      return isOwner;
    }
    if (session.claims.kind !== 'member' || session.claims.groupId !== groupId) {
      return false;
    }
    return (await this.members.get(groupId, session.userId))?.status === 'active';
  }

  options(allowedOrigins: string[]): RealtimeOptions {
    return {
      path: '/ws',
      verifyToken: (token) => this.verifyToken(token),
      authorizeSubscribe: (session, topic) => this.authorizeSubscribe(session, topic),
      allowedOrigins,
      trustedProxyHops: 1,
    };
  }
}

/** Publishes membership changes; the client re-reads members on these events. */
@Injectable()
export class RealtimeMemberEvents implements MemberEvents {
  constructor(private readonly realtime: RealtimeService) {}

  joined(groupId: string, memberId: string, pending: boolean): void {
    if (pending) {
      this.realtime.publish(ownerTopic(groupId), 'member.pending', { memberId });
    } else {
      this.realtime.publish(groupTopic(groupId), 'member.joined', { memberId });
    }
  }

  approved(groupId: string, memberId: string): void {
    this.realtime.publish(memberTopic(memberId), 'member.approved', { groupId });
    this.realtime.publish(groupTopic(groupId), 'member.joined', { memberId });
    this.realtime.refreshTopics(memberId);
  }

  removed(groupId: string, memberId: string): void {
    this.realtime.disconnectUser(memberId);
    this.realtime.publish(groupTopic(groupId), 'member.removed', { memberId });
  }
}
