import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CLOCK } from '../auth/session.service';
import { Comment, Group, Submission, SessionSubject } from '../data/models';
import {
  CELLS,
  COMMENTS,
  CellRepository,
  CommentRepository,
  MEMBERS,
  MemberRepository,
  SUBMISSIONS,
  SubmissionRepository,
} from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { NOTIFICATION_SINK, NotificationSink } from '../notifications/notification-sink';
import { PHOTO_EVENTS, PhotoEvents } from '../photos/photo-events';
import { PhotosService } from '../photos/photos.service';

export const maxCommentLength = 500;

export interface CommentItem {
  id: string;
  memberId: string;
  displayName: string;
  avatar?: string;
  text: string;
  createdAt: string;
  mine: boolean;
  canDelete: boolean;
}

/** Plain text, trimmed, 1 to [maxCommentLength] characters (code points, so emoji count once). */
function cleanText(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text.length === 0 || [...text].length > maxCommentLength) {
    throw new BadRequestException('invalid_text');
  }
  return text;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly groups: GroupsService,
    private readonly photos: PhotosService,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(COMMENTS) private readonly comments: CommentRepository,
    @Inject(PHOTO_EVENTS) private readonly events: PhotoEvents,
    @Inject(CLOCK) private readonly clock: () => Date = () => new Date(),
    @Optional() @Inject(NOTIFICATION_SINK) private readonly notifications?: NotificationSink,
  ) {}

  /** Comments under a photo the viewer sees in full, oldest first. */
  async list(subject: SessionSubject, groupId: string, dayIndex: number, authorId: string): Promise<CommentItem[]> {
    const { group, viewer } = await this.visiblePhoto(subject, groupId, dayIndex, authorId);
    return this.items(group, viewer, await this.comments.listForPhoto(groupId, dayIndex, authorId));
  }

  async add(
    subject: SessionSubject,
    groupId: string,
    dayIndex: number,
    authorId: string,
    rawText: unknown,
  ): Promise<CommentItem> {
    const text = cleanText(rawText);
    const { group, viewer } = await this.visiblePhoto(subject, groupId, dayIndex, authorId);
    if (!viewer.memberId) {
      throw new ForbiddenException('not_playing');
    }
    const comment: Comment = {
      id: randomBytes(10).toString('hex'),
      groupId,
      dayIndex,
      authorMemberId: authorId,
      memberId: viewer.memberId,
      text,
      createdAt: this.clock(),
    };
    await this.comments.add(comment);
    this.events.toGroup(groupId, 'comment.created', { dayIndex, memberId: authorId, by: viewer.memberId });
    await this.notifications?.comment(groupId, dayIndex, authorId, viewer.memberId, comment.id);
    return (await this.items(group, viewer, [comment]))[0];
  }

  /** The writer removes their own comment; the organizer removes any, even under a photo they see blurred. */
  async delete(
    subject: SessionSubject,
    groupId: string,
    dayIndex: number,
    authorId: string,
    commentId: string,
  ): Promise<void> {
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    const comment = await this.comments.get(groupId, commentId);
    if (!comment || comment.dayIndex !== dayIndex || comment.authorMemberId !== authorId) {
      throw new NotFoundException();
    }
    if (comment.memberId !== viewer.memberId && viewer.relation !== 'owner') {
      throw new ForbiddenException('not_yours');
    }
    await this.comments.delete(groupId, commentId);
    this.events.toGroup(groupId, 'comment.deleted', { dayIndex, memberId: authorId });
  }

  private async visiblePhoto(subject: SessionSubject, groupId: string, dayIndex: number, authorId: string) {
    const group = await this.groups.getFor(subject, groupId);
    const viewer = await this.photos.viewerOf(subject.kind, subject.id, group);
    const submission: Submission | undefined = await this.submissions.get(groupId, dayIndex, authorId);
    const cell = await this.cells.get(groupId, dayIndex);
    if (!submission || !cell) {
      throw new NotFoundException();
    }
    const { access } = await this.photos.accessFor(subject.kind, subject.id, group, cell, submission, this.clock());
    if (access.image !== 'full' || submission.status !== 'visible') {
      throw new ForbiddenException('not_visible');
    }
    return { group, viewer };
  }

  private async items(
    group: Group,
    viewer: { relation: string; memberId?: string },
    comments: Comment[],
  ): Promise<CommentItem[]> {
    const members = new Map((await this.members.list(group.id)).map((member) => [member.id, member]));
    return comments.map((comment) => {
      const writer = members.get(comment.memberId);
      const mine = comment.memberId === viewer.memberId;
      return {
        id: comment.id,
        memberId: comment.memberId,
        displayName: writer?.displayName ?? '',
        ...(writer?.avatar ? { avatar: writer.avatar } : {}),
        text: comment.text,
        createdAt: comment.createdAt.toISOString(),
        mine,
        canDelete: mine || viewer.relation === 'owner',
      };
    });
  }
}
