import { Inject, Injectable } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { SessionSubject } from '../data/models';
import { MEMBERS, MemberRepository, SUBMISSIONS, SubmissionRepository } from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';

export interface StandingItem {
  memberId: string;
  displayName: string;
  avatar?: string;
  points: number;
  rank: number;
  mine: boolean;
}

export interface StandingsView {
  items: StandingItem[];
  /** The viewer's own place; absent when the viewer does not play. */
  me?: { rank: number; points: number; toNext?: number };
  serverTime: string;
}

/** Base points only; speed, lateness and likes arrive with the points journal. */
const pointsPerPhoto = 10;

@Injectable()
export class StandingsService {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  async standings(subject: SessionSubject, groupId: string): Promise<StandingsView> {
    const group = await this.groups.getFor(subject, groupId);
    const [stored, members, viewer] = await Promise.all([
      this.submissions.listByGroup(groupId, group.game?.days ?? 0),
      this.members.list(groupId),
      this.photos.viewerOf(subject.kind, subject.id, group),
    ]);
    const photoCount = new Map<string, number>();
    for (const sub of stored) {
      if (sub.status === 'visible') {
        photoCount.set(sub.memberId, (photoCount.get(sub.memberId) ?? 0) + 1);
      }
    }
    const scored = members
      .filter((member) => member.status === 'active')
      .map((member) => ({ member, points: (photoCount.get(member.id) ?? 0) * pointsPerPhoto }))
      .sort((a, b) => b.points - a.points || a.member.displayName.localeCompare(b.member.displayName, 'uk'));
    const items: StandingItem[] = scored.map(({ member, points }) => ({
      memberId: member.id,
      displayName: member.displayName,
      ...(member.avatar ? { avatar: member.avatar } : {}),
      points,
      rank: 1 + scored.filter((other) => other.points > points).length,
      mine: member.id === viewer.memberId,
    }));
    const own = items.find((item) => item.mine);
    const above = own ? items.filter((item) => item.points > own.points).map((item) => item.points) : [];
    return {
      items,
      ...(own
        ? {
            me: {
              rank: own.rank,
              points: own.points,
              ...(above.length ? { toNext: Math.min(...above) - own.points } : {}),
            },
          }
        : {}),
      serverTime: this.now().toISOString(),
    };
  }
}
