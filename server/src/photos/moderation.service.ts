import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Complaint, ComplaintReason, SessionSubject } from '../data/models';
import {
  CELLS,
  CellRepository,
  COMPLAINTS,
  ComplaintRepository,
  MEMBERS,
  MemberRepository,
  SUBMISSIONS,
  SubmissionRepository,
} from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { PHOTO_EVENTS, PhotoEvents } from './photo-events';
import { PhotosService } from './photos.service';

export interface ComplaintView {
  dayIndex: number;
  memberId: string;
  displayName: string;
  reasons: Record<ComplaintReason, number>;
  complainers: { memberId: string; displayName: string }[];
  firstAt: string;
  hidden: boolean;
}

const reasons: ComplaintReason[] = ['inappropriate', 'not_task', 'other'];

/** Complaints and hiding: the owner decides, members only raise a hand. */
@Injectable()
export class ModerationService {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly photos: PhotosService,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    @Inject(COMPLAINTS) private readonly complaints: ComplaintRepository,
    @Inject(PHOTO_EVENTS) private readonly events: PhotoEvents,
    @Inject(CLOCK) private readonly clock: () => Date,
  ) {}

  /** A member complains about a photo they can see in full; a repeat is accepted and ignored. */
  async complain(
    subject: SessionSubject,
    groupId: string,
    day: number,
    authorId: string,
    reason: unknown,
  ): Promise<void> {
    const chosen = reason === undefined ? 'other' : reason;
    if (!reasons.includes(chosen as ComplaintReason)) {
      throw new UnprocessableEntityException('invalid_reason');
    }
    const group = await this.groupsService.getFor(subject, groupId);
    const cell = await this.cells.get(groupId, day);
    const sub = cell ? await this.submissions.get(groupId, day, authorId) : undefined;
    if (!cell || !sub) {
      throw new NotFoundException('no_submission');
    }
    const { viewer, access } = await this.photos.accessFor(subject.kind, subject.id, group, cell, sub, this.clock());
    if (!viewer.memberId) {
      throw new ForbiddenException('not_playing');
    }
    if (viewer.memberId === authorId) {
      throw new UnprocessableEntityException('own_photo');
    }
    if (access.image !== 'full') {
      throw new ForbiddenException('not_visible');
    }
    const complaint: Complaint = {
      id: `${String(day).padStart(2, '0')}_${authorId}_${viewer.memberId}`,
      groupId,
      dayIndex: day,
      authorMemberId: authorId,
      complainerMemberId: viewer.memberId,
      reason: chosen as ComplaintReason,
      status: 'open',
      createdAt: this.clock(),
    };
    if (await this.complaints.add(complaint)) {
      this.events.toOwner(groupId, 'complaint.created', { dayIndex: day, memberId: authorId });
    }
  }

  async list(ownerUid: string, groupId: string): Promise<{ items: ComplaintView[] }> {
    await this.groupsService.owned(ownerUid, groupId);
    const [open, members] = await Promise.all([this.complaints.listOpen(groupId), this.members.list(groupId)]);
    const names = new Map(members.map((member) => [member.id, member.displayName]));
    const byPhoto = new Map<string, Complaint[]>();
    for (const complaint of open) {
      const key = `${complaint.dayIndex}/${complaint.authorMemberId}`;
      byPhoto.set(key, [...(byPhoto.get(key) ?? []), complaint]);
    }
    const items: ComplaintView[] = [];
    for (const group of byPhoto.values()) {
      const first = group.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
      const sub = await this.submissions.get(groupId, first.dayIndex, first.authorMemberId);
      items.push({
        dayIndex: first.dayIndex,
        memberId: first.authorMemberId,
        displayName: names.get(first.authorMemberId) ?? '',
        reasons: Object.fromEntries(reasons.map((r) => [r, group.filter((c) => c.reason === r).length])) as Record<
          ComplaintReason,
          number
        >,
        complainers: group.map((c) => ({
          memberId: c.complainerMemberId,
          displayName: names.get(c.complainerMemberId) ?? '',
        })),
        firstAt: first.createdAt.toISOString(),
        hidden: sub?.status === 'hidden',
      });
    }
    return { items: items.sort((a, b) => a.firstAt.localeCompare(b.firstAt)) };
  }

  /** Hiding closes the photo's complaints; restoring does not reopen them and never unblurs anything. */
  async setHidden(ownerUid: string, groupId: string, day: number, authorId: string, hidden: boolean): Promise<void> {
    await this.groupsService.owned(ownerUid, groupId);
    const now = this.clock();
    if (!(await this.submissions.setStatus(groupId, day, authorId, hidden ? 'hidden' : 'visible', now))) {
      throw new NotFoundException('no_submission');
    }
    if (hidden) {
      await this.complaints.resolve(groupId, day, authorId, now);
    }
    this.events.toGroup(groupId, hidden ? 'submission.hidden' : 'submission.restored', {
      dayIndex: day,
      memberId: authorId,
    });
  }

  async dismiss(ownerUid: string, groupId: string, day: number, authorId: string): Promise<void> {
    await this.groupsService.owned(ownerUid, groupId);
    await this.complaints.resolve(groupId, day, authorId, this.clock());
  }
}
