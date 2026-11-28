import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Member, SessionSubject } from '../data/models';
import {
  CELLS,
  CellRepository,
  LIKES,
  LikeRepository,
  MEMBERS,
  MemberRepository,
  SUBMISSIONS,
  SubmissionRepository,
} from '../data/repositories';
import { openedDayCount } from '../game/opened-days';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { PointEntry, computePoints, totalsOf } from './points-engine';
import { PointsJournalView } from './views';

export interface PointsSnapshot {
  players: Member[];
  entries: PointEntry[];
  totals: Map<string, number>;
  /** Different active players who liked a visible photo of the member. */
  fans: Map<string, number>;
}

/** The one place that reads what the points depend on; rating and journal both come from here. */
@Injectable()
export class PointsService {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(LIKES) private readonly likes: LikeRepository,
  ) {}

  async snapshot(groupId: string): Promise<PointsSnapshot> {
    const [members, cells, likes] = await Promise.all([
      this.members.list(groupId),
      this.cells.list(groupId),
      this.likes.listByGroup(groupId),
    ]);
    const stored = await this.submissions.listByGroup(groupId, openedDayCount(cells));
    const players = members.filter((member) => member.status === 'active');
    const entries = computePoints({
      players,
      submissions: stored,
      opensAt: new Map(cells.map((cell) => [cell.dayIndex, cell.opensAt])),
      likes,
    });
    const activeIds = new Set(players.map((player) => player.id));
    const visiblePhotos = new Set(
      stored
        .filter((sub) => sub.status === 'visible' && activeIds.has(sub.memberId))
        .map((sub) => `${sub.dayIndex}/${sub.memberId}`),
    );
    const likersOf = new Map<string, Set<string>>();
    for (const like of likes) {
      if (
        like.likerMemberId !== like.authorMemberId &&
        activeIds.has(like.likerMemberId) &&
        visiblePhotos.has(`${like.dayIndex}/${like.authorMemberId}`)
      ) {
        const likers = likersOf.get(like.authorMemberId) ?? new Set<string>();
        likers.add(like.likerMemberId);
        likersOf.set(like.authorMemberId, likers);
      }
    }
    return {
      players,
      entries,
      totals: totalsOf(entries),
      fans: new Map([...likersOf].map(([author, likers]) => [author, likers.size])),
    };
  }

  /** Where the viewer's points come from, entry by entry. */
  async journalFor(subject: SessionSubject, groupId: string): Promise<PointsJournalView> {
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    if (!viewer.memberId) {
      throw new ForbiddenException('not_playing');
    }
    const { entries } = await this.snapshot(groupId);
    const mine = entries
      .filter((entry) => entry.memberId === viewer.memberId)
      .map(({ dayIndex, kind, amount, detail }) => ({
        dayIndex,
        kind,
        amount,
        ...(detail !== undefined ? { detail } : {}),
      }));
    return { total: mine.reduce((sum, entry) => sum + entry.amount, 0), entries: mine };
  }
}
