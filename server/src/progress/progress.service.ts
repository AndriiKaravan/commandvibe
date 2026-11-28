import { Inject, Injectable } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { SessionSubject } from '../data/models';
import { MEMBERS, MemberRepository, SUBMISSIONS, SubmissionRepository } from '../data/repositories';
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
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  async progressFor(subject: SessionSubject, groupId: string): Promise<ProgressView> {
    const group = await this.groups.getFor(subject, groupId);
    const days = group.game?.days ?? 0;
    const [stored, members, viewer] = await Promise.all([
      this.submissions.listByGroup(groupId, days),
      this.members.list(groupId),
      this.photos.viewerOf(subject.kind, subject.id, group),
    ]);
    const active = new Set(members.filter((member) => member.status === 'active').map((member) => member.id));
    const visible = stored.filter((sub) => sub.status === 'visible' && active.has(sub.memberId));
    return {
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
