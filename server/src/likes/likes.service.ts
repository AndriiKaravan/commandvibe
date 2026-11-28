import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { SessionSubject } from '../data/models';
import { CELLS, CellRepository, LIKES, LikeRepository, SUBMISSIONS, SubmissionRepository } from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { PHOTO_EVENTS, PhotoEvents } from '../photos/photo-events';
import { PhotosService } from '../photos/photos.service';

@Injectable()
export class LikesService {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    @Inject(LIKES) private readonly likes: LikeRepository,
    @Inject(PHOTO_EVENTS) private readonly events: PhotoEvents,
    @Inject(CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Gives or takes back the viewer's like; both are idempotent and only a real change is announced. */
  async set(
    subject: SessionSubject,
    groupId: string,
    dayIndex: number,
    authorMemberId: string,
    liked: boolean,
  ): Promise<void> {
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    if (!viewer.memberId) {
      throw new ForbiddenException('not_playing');
    }
    if (viewer.memberId === authorMemberId) {
      throw new ForbiddenException('own_photo');
    }
    const submission = await this.submissions.get(groupId, dayIndex, authorMemberId);
    const cell = await this.cells.get(groupId, dayIndex);
    if (!submission || !cell) {
      throw new NotFoundException();
    }
    const { access } = await this.photos.accessFor(subject.kind, subject.id, group, cell, submission, this.clock());
    if (access.image !== 'full' || submission.status !== 'visible') {
      throw new ForbiddenException('not_visible');
    }
    const changed = liked
      ? await this.likes.add({
          groupId,
          dayIndex,
          authorMemberId,
          likerMemberId: viewer.memberId,
          createdAt: this.clock(),
        })
      : await this.likes.remove(groupId, dayIndex, authorMemberId, viewer.memberId);
    if (changed) {
      this.events.toGroup(groupId, 'like.changed', { dayIndex, memberId: authorMemberId });
    }
  }
}
