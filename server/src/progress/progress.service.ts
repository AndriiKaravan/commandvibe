import { Inject, Injectable } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { SessionSubject } from '../data/models';
import {
  CELLS,
  CellRepository,
  MEMBERS,
  MemberRepository,
  SUBMISSIONS,
  SubmissionRepository,
} from '../data/repositories';
import { openedDayCount } from '../game/opened-days';
import { GroupsService } from '../groups/groups.service';
import { PhotosService } from '../photos/photos.service';
import { ProgressView } from './views';

@Injectable()
export class ProgressService {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  async progressFor(subject: SessionSubject, groupId: string): Promise<ProgressView> {
    const group = await this.groups.getFor(subject, groupId);
    const days = group.game?.days ?? 0;
    const [members, viewer, cells] = await Promise.all([
      this.members.list(groupId),
      this.photos.viewerOf(subject.kind, subject.id, group),
      this.cells.list(groupId),
    ]);
    const stored = await this.submissions.listByGroup(groupId, openedDayCount(cells));
    const openDays = cells.filter((cell) => cell.state === 'open').map((cell) => cell.dayIndex);
    const active = new Set(members.filter((member) => member.status === 'active').map((member) => member.id));
    const visible = stored.filter((sub) => sub.status === 'visible' && active.has(sub.memberId));
    return {
      ...(openDays.length ? { currentDay: Math.max(...openDays) } : {}),
      days: Array.from({ length: days }, (_, dayIndex) => {
        const ofDay = visible.filter((sub) => sub.dayIndex === dayIndex);
        return {
          dayIndex,
          done: ofDay.length,
          total: active.size,
          mine: viewer.memberId ? ofDay.some((sub) => sub.memberId === viewer.memberId) : null,
        };
      }),
      serverTime: this.now().toISOString(),
    };
  }
}
