import { Inject, Injectable } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { SessionSubject } from '../data/models';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { PointsService } from '../points/points.service';

export interface StandingItem {
  memberId: string;
  displayName: string;
  avatar?: string;
  points: number;
  rank: number;
  mine: boolean;
  /** Different players who liked a photo of this member. */
  fans: number;
}

export interface StandingsView {
  items: StandingItem[];
  /** The viewer's own place; absent when the viewer does not play. */
  me?: { rank: number; points: number; toNext?: number };
  serverTime: string;
}

@Injectable()
export class StandingsService {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    private readonly points: PointsService,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  async standings(subject: SessionSubject, groupId: string): Promise<StandingsView> {
    const group = await this.groups.getFor(subject, groupId);
    const [viewer, snapshot] = await Promise.all([
      this.photos.viewerOf(subject.kind, subject.id, group),
      this.points.snapshot(groupId),
    ]);
    const scored = snapshot.players
      .map((member) => ({ member, points: snapshot.totals.get(member.id) ?? 0 }))
      .sort((a, b) => b.points - a.points || a.member.displayName.localeCompare(b.member.displayName, 'uk'));
    const items: StandingItem[] = scored.map(({ member, points }) => ({
      memberId: member.id,
      displayName: member.displayName,
      ...(member.avatar ? { avatar: member.avatar } : {}),
      points,
      rank: 1 + scored.filter((other) => other.points > points).length,
      mine: member.id === viewer.memberId,
      fans: snapshot.fans.get(member.id) ?? 0,
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
