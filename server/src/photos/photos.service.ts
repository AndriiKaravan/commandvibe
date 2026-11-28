import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CLOCK } from '../auth/session.service';
import { Cell, Group, Like, Member, SessionSubject, SubjectKind, Submission, UploadSource } from '../data/models';
import {
  CELLS,
  CellRepository,
  COMMENTS,
  COMPLAINTS,
  CommentRepository,
  NOTIFICATIONS,
  NotificationRepository,
  ComplaintRepository,
  LIKES,
  LikeRepository,
  GROUPS,
  GroupRepository,
  MEMBERS,
  MemberRepository,
  SUBMISSIONS,
  SubmissionRepository,
} from '../data/repositories';
import { GameEngine } from '../game/game-engine';
import { revealAt } from '../game/game-time';
import { openedDayCount } from '../game/opened-days';
import { taskView, taskVisibleToPlayers } from '../game/views';
import { GroupsService } from '../groups/groups.service';
import { takenAtOf } from './exif-time';
import { processPhoto } from './image-pipeline';
import { PhotoRejected } from './image-type';
import { PhotoAccess, PhotoViewer, ViewerRelation, decidePhotoAccess } from './photo-access';
import { PHOTO_EVENTS, PhotoEvents } from './photo-events';
import { PHOTO_STORE, PhotoStore, photoPaths } from './photo-store';
import { PHOTO_URL_SIGNER } from './photo-url.token';
import { PhotoUrlSigner } from './photo-url';
import { Semaphore } from './upload-gate';
import { DaySubmissionsView, FeedEntry, LikeInfo, SubmissionView } from './views';

export interface SubmitOptions {
  mode: 'create' | 'replace';
  source?: string;
  /** Version being replaced; required for `replace`. */
  replaces?: string;
}

interface Viewer {
  relation: ViewerRelation;
  memberId?: string;
}

const uploadSlots = 8;
const processingSlots = 2;
const processingQueue = 6;

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly uploads = new Semaphore(uploadSlots, 0);
  private readonly processing = new Semaphore(processingSlots, processingQueue);

  constructor(
    private readonly groupsService: GroupsService,
    private readonly engine: GameEngine,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    @Inject(COMPLAINTS) private readonly complaints: ComplaintRepository,
    @Inject(LIKES) private readonly likes: LikeRepository,
    @Inject(COMMENTS) private readonly comments: CommentRepository,
    @Inject(PHOTO_STORE) private readonly store: PhotoStore,
    @Inject(PHOTO_EVENTS) private readonly events: PhotoEvents,
    @Inject(PHOTO_URL_SIGNER) private readonly signer: PhotoUrlSigner,
    @Inject(CLOCK) private readonly clock: () => Date,
    @Optional() @Inject(NOTIFICATIONS) private readonly notificationList?: NotificationRepository,
  ) {}

  /** The day's photos as this viewer may see them. */
  async list(subject: SessionSubject, groupId: string, day: number): Promise<DaySubmissionsView> {
    const now = this.clock();
    const group = await this.groupsService.getFor(subject, groupId);
    const cell = await this.dayCell(group, day);
    const viewer = await this.viewerOf(subject.kind, subject.id, group);
    const reveal = revealAt(cell.opensAt, group.timezone);
    const revealed = now.getTime() >= reveal.getTime();
    const [stored, members, complaints, allLikes, commentCounts] = await Promise.all([
      this.submissions.listDay(groupId, day),
      this.members.list(groupId),
      this.complaints.listOpen(groupId),
      this.likes.listByDay(groupId, day),
      this.comments.countsByGroup(groupId),
    ]);
    const names = new Map(members.map((member) => [member.id, member]));
    const open = (authorId: string): number =>
      complaints.filter((c) => c.dayIndex === day && c.authorMemberId === authorId).length;
    const own = viewer.memberId ? stored.find((s) => s.memberId === viewer.memberId) : undefined;
    const ownVisible = own?.status === 'visible';
    let mine: SubmissionView | undefined;
    const items: SubmissionView[] = [];
    let total = 0;
    for (const sub of [...stored].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())) {
      const author = names.get(sub.memberId);
      const authorActive = author?.status === 'active';
      if (sub.status === 'visible' && authorActive) {
        total++;
      }
      const access = this.decide(viewer, ownVisible, sub, authorActive, open(sub.memberId), revealed);
      if (!access.listed) {
        continue;
      }
      const social = {
        likes: this.likeInfo(
          allLikes,
          sub,
          access.image === 'full',
          viewer.memberId,
          names,
          group.settings.likesCountOnly,
        ),
        commentCount: access.image === 'full' ? (commentCounts.get(`${day}/${sub.memberId}`) ?? 0) : 0,
      };
      const view = this.toView(sub, author, access, social, subject, viewer, open(sub.memberId), now);
      if (sub.memberId === viewer.memberId) {
        mine = view;
      } else {
        items.push(view);
      }
    }
    const canSubmit =
      viewer.memberId !== undefined &&
      !own &&
      group.status !== 'finished' &&
      cell.state === 'open' &&
      taskVisibleToPlayers(cell, now);
    return {
      dayIndex: day,
      revealAt: reveal.toISOString(),
      revealed,
      canSubmit,
      ...(mine ? { mine } : {}),
      items,
      total,
      serverTime: now.toISOString(),
    };
  }

  /** Accepts a photo: checks the day, reads and re-encodes the image, stores the derived files only. */
  /**
   * Every day's photos as this viewer may see them, for the feed. Hidden photos and those of
   * members who are not active never appear here, whoever asks.
   */
  async feed(subject: SessionSubject, groupId: string): Promise<FeedEntry[]> {
    const now = this.clock();
    const group = await this.groupsService.getFor(subject, groupId);
    const viewer = await this.viewerOf(subject.kind, subject.id, group);
    const [members, complaints, cells, allLikes, commentCounts] = await Promise.all([
      this.members.list(groupId),
      this.complaints.listOpen(groupId),
      this.cells.list(groupId),
      this.likes.listByGroup(groupId),
      this.comments.countsByGroup(groupId),
    ]);
    const stored = await this.submissions.listByGroup(groupId, openedDayCount(cells));
    const names = new Map(members.map((member) => [member.id, member]));
    const cellOf = new Map(cells.map((cell) => [cell.dayIndex, cell]));
    const ownDays = new Set(
      stored.filter((sub) => sub.memberId === viewer.memberId && sub.status === 'visible').map((sub) => sub.dayIndex),
    );
    const entries: FeedEntry[] = [];
    for (const sub of stored) {
      const author = names.get(sub.memberId);
      const cell = cellOf.get(sub.dayIndex);
      if (sub.status !== 'visible' || author?.status !== 'active' || !cell) {
        continue;
      }
      const open = complaints.filter((c) => c.dayIndex === sub.dayIndex && c.authorMemberId === sub.memberId).length;
      const revealed = now.getTime() >= revealAt(cell.opensAt, group.timezone).getTime();
      const access = this.decide(viewer, ownDays.has(sub.dayIndex), sub, true, open, revealed);
      if (!access.listed) {
        continue;
      }
      entries.push({
        view: this.toView(
          sub,
          author,
          access,
          {
            likes: this.likeInfo(
              allLikes,
              sub,
              access.image === 'full',
              viewer.memberId,
              names,
              group.settings.likesCountOnly,
            ),
            commentCount: access.image === 'full' ? (commentCounts.get(`${sub.dayIndex}/${sub.memberId}`) ?? 0) : 0,
          },
          subject,
          viewer,
          open,
          now,
        ),
        dayIndex: sub.dayIndex,
        taskTitle: taskView(cell.task).title,
        revealAt: revealAt(cell.opensAt, group.timezone).toISOString(),
      });
    }
    return entries;
  }

  async submit(
    subject: SessionSubject,
    groupId: string,
    day: number,
    options: SubmitOptions,
    readBody: () => Promise<Buffer>,
  ): Promise<SubmissionView> {
    const now = this.clock();
    const group = await this.groupsService.getFor(subject, groupId);
    await this.engine.advance(groupId, now);
    const viewer = await this.viewerOf(subject.kind, subject.id, group);
    if (!viewer.memberId) {
      throw new ForbiddenException('not_playing');
    }
    const memberId = viewer.memberId;
    const current = await this.groups.get(groupId);
    if (current?.status === 'finished') {
      throw new ConflictException('game_finished');
    }
    const cell = await this.dayCell(group, day);
    if (cell.state !== 'open' || !taskVisibleToPlayers(cell, now)) {
      throw new ConflictException('day_not_open');
    }
    const existing = await this.submissions.get(groupId, day, memberId);
    this.checkVersions(options, existing, cell, group, now);
    const bytes = await this.uploads.run(readBody);
    const processed = await this.processing.run(() => this.process(bytes));
    const takenAt = takenAtOf(processed.exifTime, group.timezone, now);
    const version = randomBytes(8).toString('hex');
    const paths = photoPaths(groupId, day, memberId, version);
    const submission: Submission = {
      groupId,
      dayIndex: day,
      memberId,
      version,
      photoPath: paths.photo,
      blurPath: paths.blur,
      width: processed.width,
      height: processed.height,
      submittedAt: existing?.submittedAt ?? now,
      updatedAt: now,
      ...(takenAt ? { takenAt } : {}),
      source: sourceOf(options.source),
      flags: { takenBefore: takenAt !== undefined && cell.openedAt !== undefined && takenAt < cell.openedAt },
      status: 'visible',
    };
    const discard = () => this.store.delete([paths.photo, paths.blur]).catch(() => undefined);
    let result: 'created' | 'replaced' | 'conflict';
    try {
      await this.store.put(paths.photo, processed.photo, 'image/jpeg');
      await this.store.put(paths.blur, processed.blur, 'image/jpeg');
      result = await this.submissions.put(submission, options.mode === 'create' ? null : (options.replaces ?? ''));
    } catch (error) {
      await discard();
      throw error;
    }
    if (result === 'conflict') {
      await discard();
      throw await this.conflictFor(options, groupId, day, memberId);
    }
    // The member may have been removed while the photo was processed; nothing of theirs may stay.
    if ((await this.members.get(groupId, memberId))?.status !== 'active') {
      await this.deleteMemberData(groupId, memberId);
      throw new ForbiddenException('not_playing');
    }
    if (result === 'replaced') {
      // Complaints and likes were about the earlier photo.
      await this.complaints.resolve(groupId, day, memberId, now);
      await this.likes.deleteForPhoto(groupId, day, memberId);
      await this.comments.deleteForPhoto(groupId, day, memberId);
    }
    if (result === 'replaced' && existing) {
      await this.store.delete([existing.photoPath, existing.blurPath]).catch((error: unknown) => {
        this.logger.warn(`could not delete replaced files of ${groupId}/${day}/${memberId}: ${String(error)}`);
      });
    }
    this.events.toGroup(groupId, result === 'created' ? 'submission.created' : 'submission.replaced', {
      dayIndex: day,
      memberId,
    });
    const author = await this.members.get(groupId, memberId);
    const access = this.decide(viewer, true, submission, true, 0, false);
    return this.toView(
      submission,
      author,
      access,
      { likes: { count: 0, mine: false, canLike: false }, commentCount: 0 },
      subject,
      viewer,
      0,
      now,
    );
  }

  /** The bytes behind a link, or undefined when the link must not work: the caller answers 404 either way. */
  async fileFor(token: string): Promise<{ bytes: Buffer; maxAgeSeconds: number } | undefined> {
    const now = this.clock();
    const verified = this.signer.verifyWithExpiry(token, now);
    if (!verified) {
      return undefined;
    }
    const { claims, expiresAt } = verified;
    const group = await this.groups.get(claims.g);
    const cell = group ? await this.cells.get(claims.g, claims.d) : undefined;
    const sub = cell ? await this.submissions.get(claims.g, claims.d, claims.a) : undefined;
    if (!group || !cell || !sub || sub.version !== claims.v) {
      return undefined;
    }
    const { access } = await this.accessFor(claims.k, claims.s, group, cell, sub, now);
    const allowed = claims.x === 'photo' ? access.image === 'full' : access.listed && access.image !== 'none';
    if (!allowed) {
      return undefined;
    }
    const bytes = await this.store.get(claims.x === 'photo' ? sub.photoPath : sub.blurPath);
    if (!bytes) {
      return undefined;
    }
    return { bytes, maxAgeSeconds: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)) };
  }

  /** The one place that gathers the facts and asks [decidePhotoAccess]; lists, files and moderation all use it. */
  async accessFor(
    kind: SubjectKind,
    id: string,
    group: Group,
    cell: Cell,
    sub: Submission,
    now: Date,
  ): Promise<{ viewer: Viewer; access: PhotoAccess }> {
    const viewer = await this.viewerOf(kind, id, group);
    const ownVisible = viewer.memberId
      ? (await this.submissions.get(group.id, sub.dayIndex, viewer.memberId))?.status === 'visible'
      : false;
    const author = await this.members.get(group.id, sub.memberId);
    const openComplaints = await this.complaints.openCount(group.id, sub.dayIndex, sub.memberId);
    const revealed = now.getTime() >= revealAt(cell.opensAt, group.timezone).getTime();
    const access = this.decide(viewer, ownVisible, sub, author?.status === 'active', openComplaints, revealed);
    return { viewer, access };
  }

  /** Removes everything a member uploaded or filed, files first so no orphan survives a half-done call. */
  async deleteMemberData(groupId: string, memberId: string): Promise<void> {
    const group = await this.groups.get(groupId);
    const days = group?.game?.days ?? 0;
    const own = await this.submissions.listMember(groupId, memberId, days);
    for (const sub of own) {
      await this.store.deletePrefix(photoPaths(groupId, sub.dayIndex, memberId, '').prefix);
      await this.submissions.delete(groupId, sub.dayIndex, memberId);
    }
    await this.complaints.deleteInvolving(groupId, memberId);
    await this.likes.deleteInvolving(groupId, memberId);
    await this.comments.deleteInvolving(groupId, memberId);
    await this.notificationList?.deleteInvolving(groupId, memberId);
  }

  private async process(bytes: Buffer) {
    try {
      return await processPhoto(bytes);
    } catch (error) {
      if (error instanceof PhotoRejected) {
        if (error.code === 'invalid_image') {
          throw new UnprocessableEntityException('invalid_image');
        }
        throw new UnsupportedMediaTypeException(error.code);
      }
      throw error;
    }
  }

  private checkVersions(options: SubmitOptions, existing: Submission | undefined, cell: Cell, group: Group, now: Date) {
    if (options.mode === 'create') {
      if (existing) {
        throw new ConflictException({ message: 'already_submitted', version: existing.version });
      }
      return;
    }
    if (!existing || existing.version !== options.replaces) {
      throw new ConflictException('version_mismatch');
    }
    if (existing.status === 'hidden') {
      throw new ConflictException('photo_hidden');
    }
    if (now.getTime() >= revealAt(cell.opensAt, group.timezone).getTime()) {
      throw new ConflictException('reveal_passed');
    }
  }

  private async conflictFor(options: SubmitOptions, groupId: string, day: number, memberId: string) {
    if (options.mode === 'replace') {
      return new ConflictException('version_mismatch');
    }
    const winner = await this.submissions.get(groupId, day, memberId);
    return new ConflictException({ message: 'already_submitted', version: winner?.version });
  }

  private async dayCell(group: Group, day: number): Promise<Cell> {
    const cell = group.game ? await this.cells.get(group.id, day) : undefined;
    if (!cell) {
      throw new NotFoundException('no_such_day');
    }
    return cell;
  }

  /** Who is looking and which member record, if any, plays for them. */
  async viewerOf(kind: SubjectKind, id: string, group: Group): Promise<Viewer> {
    if (kind === 'organizer') {
      if (id !== group.ownerUid) {
        return { relation: 'outsider' };
      }
      const playing = (await this.members.list(group.id)).find((m) => m.organizerUid === id && m.status === 'active');
      return { relation: 'owner', memberId: playing?.id };
    }
    const member = await this.members.get(group.id, id);
    if (!member) {
      return { relation: 'outsider' };
    }
    if (member.status === 'active') {
      return { relation: 'member', memberId: member.id };
    }
    return { relation: member.status };
  }

  private decide(
    viewer: Viewer,
    ownVisibleSubmission: boolean,
    sub: Submission,
    authorActive: boolean,
    openComplaints: number,
    revealed: boolean,
  ): PhotoAccess {
    const asViewer: PhotoViewer = { relation: viewer.relation, memberId: viewer.memberId, ownVisibleSubmission };
    return decidePhotoAccess(
      asViewer,
      { authorMemberId: sub.memberId, authorActive, hidden: sub.status === 'hidden', openComplaints },
      revealed,
    );
  }

  /** Likes of one photo as the viewer may see them; a blurred photo shows none. */
  private likeInfo(
    all: Like[],
    sub: Submission,
    visibleInFull: boolean,
    viewerMemberId: string | undefined,
    members: ReadonlyMap<string, Member>,
    countOnly: boolean,
  ): LikeInfo {
    if (!visibleInFull) {
      return { count: 0, mine: false, canLike: false };
    }
    const likers = all
      .filter((l) => l.dayIndex === sub.dayIndex && l.authorMemberId === sub.memberId)
      .filter((l) => members.get(l.likerMemberId)?.status === 'active')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const info: LikeInfo = {
      count: likers.length,
      mine: likers.some((l) => l.likerMemberId === viewerMemberId),
      canLike: viewerMemberId !== undefined && viewerMemberId !== sub.memberId && sub.status === 'visible',
    };
    if (!countOnly) {
      info.by = likers.map((l) => {
        const member = members.get(l.likerMemberId)!;
        return {
          memberId: member.id,
          displayName: member.displayName,
          ...(member.avatar ? { avatar: member.avatar } : {}),
        };
      });
    }
    return info;
  }

  private toView(
    sub: Submission,
    author: Pick<Member, 'displayName' | 'avatar'> | undefined,
    access: PhotoAccess,
    social: { likes: LikeInfo; commentCount: number },
    subject: SessionSubject,
    viewer: Viewer,
    openComplaints: number,
    now: Date,
  ): SubmissionView {
    const link = (x: 'photo' | 'blur'): string =>
      this.signer.sign(
        { g: sub.groupId, d: sub.dayIndex, a: sub.memberId, v: sub.version, x, k: subject.kind, s: subject.id },
        now,
      );
    const mine = sub.memberId === viewer.memberId;
    const view: SubmissionView = {
      memberId: sub.memberId,
      displayName: author?.displayName ?? '',
      ...(author?.avatar ? { avatar: author.avatar } : {}),
      submittedAt: sub.submittedAt.toISOString(),
      access: access.image === 'full' ? 'full' : 'blur',
      likes: social.likes,
      commentCount: social.commentCount,
      blurUrl: link('blur'),
      width: sub.width,
      height: sub.height,
      mine,
    };
    if (access.image === 'full') {
      view.photoUrl = link('photo');
    }
    if (mine) {
      view.version = sub.version;
    }
    if (mine || access.moderation) {
      view.status = sub.status;
    }
    if (access.moderation) {
      view.moderation = {
        takenBefore: sub.flags.takenBefore,
        ...(sub.takenAt ? { takenAt: sub.takenAt.toISOString() } : {}),
        source: sub.source,
        openComplaints,
      };
    }
    return view;
  }
}

function sourceOf(value: string | undefined): UploadSource {
  return value === 'camera' || value === 'gallery' ? value : 'unknown';
}
