import { Cell, Comment, Complaint, Group, Like, Member, Session, Submission, defaultGroupSettings, nameKeyOf } from './models';
import {
  CellRepository,
  CommentRepository,
  ComplaintRepository,
  GroupRepository,
  LikeRepository,
  MemberRepository,
  NameTakenError,
  SessionRepository,
  SubmissionRepository,
} from './repositories';

export interface RepositorySet {
  cells: CellRepository;
  groups: GroupRepository;
  members: MemberRepository;
  sessions: SessionRepository;
  submissions: SubmissionRepository;
  complaints: ComplaintRepository;
  likes: LikeRepository;
  comments: CommentRepository;
}

let counter = 0;
const nextId = (prefix: string): string => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function aGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId('g'),
    ownerUid: 'owner-1',
    name: 'Office',
    timezone: 'Europe/Kyiv',
    status: 'draft',
    settings: { ...defaultGroupSettings },
    inviteTokenHash: nextId('hash'),
    inviteClosed: false,
    createdAt: new Date(),
    ...overrides,
  };
}

export function aMember(groupId: string, displayName: string, overrides: Partial<Member> = {}): Member {
  return {
    id: nextId('m'),
    groupId,
    displayName: displayName.trim(),
    nameKey: nameKeyOf(displayName),
    status: 'active',
    isOrganizer: false,
    createdAt: new Date(),
    ...overrides,
  };
}

export function aCell(groupId: string, dayIndex: number, overrides: Partial<Cell> = {}): Cell {
  return {
    groupId,
    dayIndex,
    task: { kind: 'catalog', taskId: `task-${dayIndex}` },
    opensAt: new Date(Date.UTC(2026, 11, 1 + dayIndex, 7)),
    state: 'closed',
    ...overrides,
  };
}

export function aSubmission(
  groupId: string,
  dayIndex: number,
  memberId: string,
  overrides: Partial<Submission> = {},
): Submission {
  return {
    groupId,
    dayIndex,
    memberId,
    version: nextId('v'),
    photoPath: `groups/${groupId}/cells/0${dayIndex}/${memberId}/v/photo.jpg`,
    blurPath: `groups/${groupId}/cells/0${dayIndex}/${memberId}/v/blur.jpg`,
    width: 1600,
    height: 1200,
    submittedAt: new Date('2026-12-01T08:00:00Z'),
    updatedAt: new Date('2026-12-01T08:00:00Z'),
    source: 'camera',
    flags: { takenBefore: false },
    status: 'visible',
    ...overrides,
  };
}

export function aComplaint(groupId: string, dayIndex: number, author: string, complainer: string): Complaint {
  return {
    id: `0${dayIndex}_${author}_${complainer}`,
    groupId,
    dayIndex,
    authorMemberId: author,
    complainerMemberId: complainer,
    reason: 'other',
    status: 'open',
    createdAt: new Date('2026-12-02T08:00:00Z'),
  };
}

export function aComment(
  groupId: string,
  dayIndex: number,
  author: string,
  commenter: string,
  overrides: Partial<Comment> = {},
): Comment {
  return {
    id: nextId('c'),
    groupId,
    dayIndex,
    authorMemberId: author,
    memberId: commenter,
    text: 'Nice!',
    createdAt: new Date('2026-12-02T09:00:00Z'),
    ...overrides,
  };
}

export function aLike(groupId: string, dayIndex: number, author: string, liker: string): Like {
  return {
    groupId,
    dayIndex,
    authorMemberId: author,
    likerMemberId: liker,
    createdAt: new Date('2026-12-02T09:00:00Z'),
  };
}

function aSession(subjectId: string): Session {
  return {
    id: nextId('s'),
    subject: { kind: 'member', id: subjectId, groupId: 'g' },
    refreshTokenHash: 'h',
    deviceInfo: 'test',
    createdAt: new Date(),
  };
}

/** Behaviour every repository implementation must share. */
export function describeRepositories(name: string, factory: () => Promise<RepositorySet>): void {
  describe(`${name} repositories`, () => {
    let repos: RepositorySet;

    beforeEach(async () => {
      repos = await factory();
    });

    it('should keep names unique per group under concurrency', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      const results = await Promise.allSettled([
        repos.members.createUnique(aMember(group.id, ' Olena ')),
        repos.members.createUnique(aMember(group.id, 'olena')),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(NameTakenError);
      expect(await repos.members.list(group.id)).toHaveLength(1);
    });

    it('should accept names that are awkward as storage keys', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      for (const name of ['.', '..', '__init__', 'a/b', 'Олена']) {
        await expect(repos.members.createUnique(aMember(group.id, name))).resolves.toBeDefined();
      }
      expect((await repos.members.findByName(group.id, '..'))?.displayName).toBe('..');
    });

    it('should set and clear a member avatar', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      const member = aMember(group.id, 'Olena');
      await repos.members.createUnique(member);
      await repos.members.update(group.id, member.id, { avatar: 'av03' });
      expect((await repos.members.get(group.id, member.id))?.avatar).toBe('av03');
      await repos.members.update(group.id, member.id, { avatar: undefined });
      expect((await repos.members.get(group.id, member.id))?.avatar).toBeUndefined();
    });

    it('should allow the same name in another group', async () => {
      const first = aGroup();
      const second = aGroup();
      await repos.groups.create(first);
      await repos.groups.create(second);
      await repos.members.createUnique(aMember(first.id, 'Olena'));
      await expect(repos.members.createUnique(aMember(second.id, 'Olena'))).resolves.toBeDefined();
    });

    it('should release the old name and reserve the new one on rename', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      const olena = await repos.members.createUnique(aMember(group.id, 'Olena'));
      await repos.members.createUnique(aMember(group.id, 'Taras'));
      await expect(
        repos.members.update(group.id, olena.id, { displayName: 'Taras', nameKey: nameKeyOf('Taras') }),
      ).rejects.toBeInstanceOf(NameTakenError);
      await repos.members.update(group.id, olena.id, { displayName: 'Lena', nameKey: nameKeyOf('Lena') });
      await expect(repos.members.createUnique(aMember(group.id, 'Olena'))).resolves.toBeDefined();
      expect((await repos.members.findByName(group.id, 'lena'))?.id).toBe(olena.id);
    });

    it('should find a group by invite hash', async () => {
      const group = aGroup({ inviteTokenHash: 'abc123' });
      await repos.groups.create(group);
      expect((await repos.groups.findByInviteHash('abc123'))?.id).toBe(group.id);
      await repos.groups.update(group.id, { inviteTokenHash: 'def456' });
      expect(await repos.groups.findByInviteHash('abc123')).toBeUndefined();
      expect((await repos.groups.findByInviteHash('def456'))?.id).toBe(group.id);
    });

    it('should revoke all sessions of a subject', async () => {
      const mine = [aSession('member-a'), aSession('member-a')];
      const other = aSession('member-b');
      for (const session of [...mine, other]) {
        await repos.sessions.create(session);
      }
      const at = new Date();
      await repos.sessions.revokeAllFor('member-a', at);
      for (const session of mine) {
        expect((await repos.sessions.get(session.id))?.revokedAt?.getTime()).toBe(at.getTime());
      }
      expect((await repos.sessions.get(other.id))?.revokedAt).toBeUndefined();
    });

    it('should start member secrets with zero failures', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      const member = await repos.members.createUnique(aMember(group.id, 'Olena'));
      expect(await repos.members.secrets(group.id, member.id)).toEqual({ pinFailures: 0 });
      await repos.members.updateSecrets(group.id, member.id, { pinHash: 'x', pinFailures: 2 });
      expect(await repos.members.secrets(group.id, member.id)).toEqual({ pinHash: 'x', pinFailures: 2 });
    });

    it('should hand out at most 5 PIN attempts to parallel callers, then lock', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      const member = await repos.members.createUnique(aMember(group.id, 'Olena'));
      await repos.members.updateSecrets(group.id, member.id, { pinHash: 'h' });
      const now = new Date(Date.UTC(2026, 11, 1));
      const results = await Promise.all(
        Array.from({ length: 12 }, () => repos.members.reservePinAttempt(group.id, member.id, now, 5, 900_000)),
      );
      expect(results.filter((r) => r.kind === 'attempt')).toHaveLength(5);
      expect(results.filter((r) => r.kind === 'locked')).toHaveLength(7);
      const secrets = await repos.members.secrets(group.id, member.id);
      expect(secrets.pinFailures).toBe(5);
      expect(secrets.lockedUntil?.getTime()).toBe(now.getTime() + 900_000);
      // Twelve transactions on one document queue up on the Firestore emulator for a few seconds.
    }, 30_000);

    it('should start a fresh series after the lock expires', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      const member = await repos.members.createUnique(aMember(group.id, 'Olena'));
      const lockedAt = new Date(Date.UTC(2026, 11, 1));
      await repos.members.updateSecrets(group.id, member.id, { pinHash: 'h', pinFailures: 5, lockedUntil: lockedAt });
      const later = new Date(lockedAt.getTime() + 1);
      const result = await repos.members.reservePinAttempt(group.id, member.id, later, 5, 900_000);
      expect(result).toEqual({ kind: 'attempt', attempt: 1, pinHash: 'h' });
    });

    it('should clear a secret field patched with undefined', async () => {
      const group = aGroup();
      await repos.groups.create(group);
      const member = await repos.members.createUnique(aMember(group.id, 'Olena'));
      await repos.members.updateSecrets(group.id, member.id, { pinHash: 'x', pinFailures: 5, lockedUntil: new Date() });
      await repos.members.updateSecrets(group.id, member.id, {
        pinHash: undefined,
        pinFailures: 0,
        lockedUntil: undefined,
      });
      const secrets = await repos.members.secrets(group.id, member.id);
      expect(secrets.pinHash).toBeUndefined();
      expect(secrets.lockedUntil).toBeUndefined();
      expect(secrets.pinFailures).toBe(0);
    });
    describe('submissions', () => {
      it('should create a submission once when two creates race', async () => {
        const group = aGroup();
        const results = await Promise.all(
          Array.from({ length: 10 }, () => repos.submissions.put(aSubmission(group.id, 1, 'm1'), null)),
        );
        expect(results.filter((r) => r === 'created')).toHaveLength(1);
        expect(results.filter((r) => r === 'conflict')).toHaveLength(9);
      });

      it('should replace only when the expected version matches', async () => {
        const group = aGroup();
        const first = aSubmission(group.id, 1, 'm1');
        await repos.submissions.put(first, null);
        const second = aSubmission(group.id, 1, 'm1', { width: 800 });
        expect(await repos.submissions.put(second, 'wrong')).toBe('conflict');
        expect(await repos.submissions.put(second, first.version)).toBe('replaced');
        expect((await repos.submissions.get(group.id, 1, 'm1'))?.width).toBe(800);
        expect(await repos.submissions.put(aSubmission(group.id, 2, 'm1'), first.version)).toBe('conflict');
      });

      it('should round-trip dates, flags and an absent takenAt', async () => {
        const group = aGroup();
        const taken = aSubmission(group.id, 1, 'm1', {
          takenAt: new Date('2026-12-01T06:59:00Z'),
          flags: { takenBefore: true },
          source: 'gallery',
        });
        await repos.submissions.put(taken, null);
        expect(await repos.submissions.get(group.id, 1, 'm1')).toEqual(taken);
        await repos.submissions.put(aSubmission(group.id, 1, 'm2'), null);
        expect((await repos.submissions.get(group.id, 1, 'm2'))?.takenAt).toBeUndefined();
        expect(await repos.submissions.get(group.id, 1, 'nobody')).toBeUndefined();
      });

      it("should list a day and a member's submissions", async () => {
        const group = aGroup();
        await repos.submissions.put(aSubmission(group.id, 1, 'm1'), null);
        await repos.submissions.put(aSubmission(group.id, 1, 'm2'), null);
        await repos.submissions.put(aSubmission(group.id, 3, 'm1'), null);
        await repos.submissions.put(aSubmission(group.id, 9, 'm1'), null);
        expect((await repos.submissions.listDay(group.id, 1)).map((s) => s.memberId).sort()).toEqual(['m1', 'm2']);
        expect((await repos.submissions.listMember(group.id, 'm1', 5)).map((s) => s.dayIndex).sort()).toEqual([1, 3]);
      });

      it('should list the photos of every day of one group only', async () => {
        const group = aGroup();
        const other = aGroup();
        await repos.submissions.put(aSubmission(group.id, 0, 'm1'), null);
        await repos.submissions.put(aSubmission(group.id, 2, 'm2'), null);
        await repos.submissions.put(aSubmission(group.id, 2, 'm1'), null);
        await repos.submissions.put(aSubmission(group.id, 9, 'm1'), null);
        await repos.submissions.put(aSubmission(other.id, 0, 'm1'), null);
        const found = await repos.submissions.listByGroup(group.id, 5);
        expect(found.map((s) => `${s.dayIndex}:${s.memberId}`).sort()).toEqual(['0:m1', '2:m1', '2:m2']);
        expect(await repos.submissions.listByGroup(group.id, 0)).toEqual([]);
      });

      it('should refuse a replacement of a photo hidden in the meantime', async () => {
        const group = aGroup();
        const first = aSubmission(group.id, 1, 'm1');
        await repos.submissions.put(first, null);
        await repos.submissions.setStatus(group.id, 1, 'm1', 'hidden', new Date());
        const next = aSubmission(group.id, 1, 'm1');
        expect(await repos.submissions.put(next, first.version)).toBe('conflict');
        expect((await repos.submissions.get(group.id, 1, 'm1'))?.version).toBe(first.version);
      });

      it('should hide, restore and delete a submission', async () => {
        const group = aGroup();
        await repos.submissions.put(aSubmission(group.id, 1, 'm1'), null);
        const at = new Date('2026-12-02T10:00:00Z');
        expect(await repos.submissions.setStatus(group.id, 1, 'm1', 'hidden', at)).toBe(true);
        const hidden = await repos.submissions.get(group.id, 1, 'm1');
        expect(hidden?.status).toBe('hidden');
        expect(hidden?.hiddenAt).toEqual(at);
        expect(await repos.submissions.setStatus(group.id, 1, 'm1', 'visible', at)).toBe(true);
        expect((await repos.submissions.get(group.id, 1, 'm1'))?.hiddenAt).toBeUndefined();
        expect(await repos.submissions.setStatus(group.id, 1, 'nobody', 'hidden', at)).toBe(false);
        await repos.submissions.delete(group.id, 1, 'm1');
        expect(await repos.submissions.get(group.id, 1, 'm1')).toBeUndefined();
        await repos.submissions.delete(group.id, 1, 'm1');
      });
    });

    describe('comments', () => {
      it('should list the comments under one photo from the oldest', async () => {
        const group = aGroup();
        const late = aComment(group.id, 1, 'a', 'b', { text: 'second', createdAt: new Date('2026-12-02T10:00:00Z') });
        const early = aComment(group.id, 1, 'a', 'c', { text: 'first', createdAt: new Date('2026-12-02T09:00:00Z') });
        await repos.comments.add(late);
        await repos.comments.add(early);
        await repos.comments.add(aComment(group.id, 1, 'x', 'b'));
        await repos.comments.add(aComment(group.id, 2, 'a', 'b'));
        expect((await repos.comments.listForPhoto(group.id, 1, 'a')).map((c) => c.text)).toEqual(['first', 'second']);
      });

      it('should count the comments of each photo of a group', async () => {
        const group = aGroup();
        await repos.comments.add(aComment(group.id, 1, 'a', 'b'));
        await repos.comments.add(aComment(group.id, 1, 'a', 'c'));
        await repos.comments.add(aComment(group.id, 2, 'a', 'b'));
        await repos.comments.add(aComment(aGroup().id, 1, 'a', 'b'));
        const counts = await repos.comments.countsByGroup(group.id);
        expect(counts.get('1/a')).toBe(2);
        expect(counts.get('2/a')).toBe(1);
        expect(counts.size).toBe(2);
      });

      it('should find and delete one comment', async () => {
        const group = aGroup();
        const comment = aComment(group.id, 1, 'a', 'b');
        await repos.comments.add(comment);
        expect((await repos.comments.get(group.id, comment.id))?.text).toBe('Nice!');
        await repos.comments.delete(group.id, comment.id);
        expect(await repos.comments.get(group.id, comment.id)).toBeUndefined();
      });

      it('should delete the comments under one photo only', async () => {
        const group = aGroup();
        await repos.comments.add(aComment(group.id, 1, 'a', 'b'));
        await repos.comments.add(aComment(group.id, 1, 'x', 'b'));
        await repos.comments.add(aComment(group.id, 2, 'a', 'b'));
        await repos.comments.deleteForPhoto(group.id, 1, 'a');
        const counts = await repos.comments.countsByGroup(group.id);
        expect([...counts.keys()].sort()).toEqual(['1/x', '2/a']);
      });

      it('should delete the comments a member wrote and received', async () => {
        const group = aGroup();
        await repos.comments.add(aComment(group.id, 1, 'a', 'b'));
        await repos.comments.add(aComment(group.id, 1, 'b', 'c'));
        await repos.comments.add(aComment(group.id, 1, 'c', 'd'));
        await repos.comments.deleteInvolving(group.id, 'b');
        const counts = await repos.comments.countsByGroup(group.id);
        expect([...counts.keys()]).toEqual(['1/c']);
      });
    });

    describe('likes', () => {
      it('should keep one like per liker and photo', async () => {
        const group = aGroup();
        expect(await repos.likes.add(aLike(group.id, 1, 'a', 'b'))).toBe(true);
        expect(await repos.likes.add(aLike(group.id, 1, 'a', 'b'))).toBe(false);
        expect(await repos.likes.add(aLike(group.id, 1, 'a', 'c'))).toBe(true);
        expect(await repos.likes.add(aLike(group.id, 2, 'a', 'b'))).toBe(true);
        expect(await repos.likes.listByGroup(group.id)).toHaveLength(3);
      });

      it('should remove a like and say whether there was one', async () => {
        const group = aGroup();
        await repos.likes.add(aLike(group.id, 1, 'a', 'b'));
        expect(await repos.likes.remove(group.id, 1, 'a', 'b')).toBe(true);
        expect(await repos.likes.remove(group.id, 1, 'a', 'b')).toBe(false);
        expect(await repos.likes.listByGroup(group.id)).toEqual([]);
      });

      it('should list only the likes of the asked group', async () => {
        const group = aGroup();
        const other = aGroup();
        await repos.likes.add(aLike(group.id, 1, 'a', 'b'));
        await repos.likes.add(aLike(other.id, 1, 'a', 'b'));
        expect((await repos.likes.listByGroup(group.id)).map((l) => l.groupId)).toEqual([group.id]);
      });

      it('should delete the likes under one photo only', async () => {
        const group = aGroup();
        await repos.likes.add(aLike(group.id, 1, 'a', 'b'));
        await repos.likes.add(aLike(group.id, 1, 'a', 'c'));
        await repos.likes.add(aLike(group.id, 1, 'x', 'b'));
        await repos.likes.add(aLike(group.id, 2, 'a', 'b'));
        await repos.likes.deleteForPhoto(group.id, 1, 'a');
        const left = await repos.likes.listByGroup(group.id);
        expect(left.map((l) => `${l.dayIndex}:${l.authorMemberId}:${l.likerMemberId}`).sort()).toEqual([
          '1:x:b',
          '2:a:b',
        ]);
      });

      it('should delete the likes a member gave and received', async () => {
        const group = aGroup();
        await repos.likes.add(aLike(group.id, 1, 'a', 'b'));
        await repos.likes.add(aLike(group.id, 1, 'b', 'c'));
        await repos.likes.add(aLike(group.id, 1, 'c', 'd'));
        await repos.likes.deleteInvolving(group.id, 'b');
        const left = await repos.likes.listByGroup(group.id);
        expect(left.map((l) => `${l.authorMemberId}:${l.likerMemberId}`)).toEqual(['c:d']);
      });
    });

    describe('complaints', () => {
      it('should count one complaint per complainer and photo', async () => {
        const group = aGroup();
        expect(await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c1'))).toBe(true);
        expect(await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c1'))).toBe(false);
        expect(await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c2'))).toBe(true);
        expect(await repos.complaints.openCount(group.id, 1, 'a')).toBe(2);
        expect(await repos.complaints.openCount(group.id, 1, 'other')).toBe(0);
        expect(await repos.complaints.listOpen(group.id)).toHaveLength(2);
      });

      it('should reopen a resolved complaint when the same person complains again', async () => {
        const group = aGroup();
        await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c1'));
        await repos.complaints.resolve(group.id, 1, 'a', new Date('2026-12-03T00:00:00Z'));
        expect(await repos.complaints.openCount(group.id, 1, 'a')).toBe(0);
        expect(await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c1'))).toBe(true);
        expect(await repos.complaints.openCount(group.id, 1, 'a')).toBe(1);
        expect(await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c1'))).toBe(false);
      });

      it('should resolve open complaints of one photo only', async () => {
        const group = aGroup();
        await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c1'));
        await repos.complaints.add(aComplaint(group.id, 1, 'b', 'c1'));
        const resolved = await repos.complaints.resolve(group.id, 1, 'a', new Date('2026-12-03T00:00:00Z'));
        expect(resolved).toBe(1);
        expect((await repos.complaints.listOpen(group.id)).map((c) => c.authorMemberId)).toEqual(['b']);
        expect(await repos.complaints.openCount(group.id, 1, 'a')).toBe(0);
      });

      it('should delete complaints filed by or against a member', async () => {
        const group = aGroup();
        await repos.complaints.add(aComplaint(group.id, 1, 'a', 'c1'));
        await repos.complaints.add(aComplaint(group.id, 2, 'c1', 'x'));
        await repos.complaints.add(aComplaint(group.id, 1, 'b', 'y'));
        await repos.complaints.deleteInvolving(group.id, 'c1');
        expect((await repos.complaints.listOpen(group.id)).map((c) => c.authorMemberId)).toEqual(['b']);
      });
    });

    it('should mark a day revealed once under concurrency', async () => {
      const group = aGroup();
      await repos.cells.replaceAll(group.id, [aCell(group.id, 0, { state: 'open' })]);
      const at = new Date('2026-12-03T07:00:00Z');
      const results = await Promise.all(Array.from({ length: 5 }, () => repos.cells.markRevealed(group.id, 0, at)));
      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await repos.cells.get(group.id, 0))?.revealedAt).toEqual(at);
      expect(await repos.cells.markRevealed(group.id, 7, at)).toBe(false);
    });

    describe('cells', () => {
      it('should list the cells of a group in day order', async () => {
        const group = aGroup();
        await repos.cells.replaceAll(group.id, [aCell(group.id, 2), aCell(group.id, 0), aCell(group.id, 1)]);
        const days = (await repos.cells.list(group.id)).map((cell) => cell.dayIndex);
        expect(days).toEqual([0, 1, 2]);
      });

      it('should replace all cells of a group and leave other groups alone', async () => {
        const group = aGroup();
        const other = aGroup();
        await repos.cells.replaceAll(group.id, [aCell(group.id, 0), aCell(group.id, 1), aCell(group.id, 2)]);
        await repos.cells.replaceAll(other.id, [aCell(other.id, 0)]);
        await repos.cells.replaceAll(group.id, [aCell(group.id, 0, { task: { kind: 'catalog', taskId: 'new' } })]);
        const cells = await repos.cells.list(group.id);
        expect(cells).toHaveLength(1);
        expect(cells[0].task).toEqual({ kind: 'catalog', taskId: 'new' });
        expect(await repos.cells.list(other.id)).toHaveLength(1);
      });

      it('should round-trip dates, custom tasks and a spin', async () => {
        const group = aGroup();
        const cell = aCell(group.id, 0, {
          task: { kind: 'custom', title: { uk: 'Моє' }, description: { uk: 'Опис', en: 'Text' } },
          state: 'open',
          openedAt: new Date(Date.UTC(2026, 11, 1, 7, 0, 1)),
          pickerMemberId: 'm1',
          pickDeadlineAt: new Date(Date.UTC(2026, 11, 1, 10)),
          spin: {
            startAt: new Date(Date.UTC(2026, 11, 1, 7, 0, 2)),
            durationMs: 5000,
            doors: [3, 1, 2],
            winnerIndex: 1,
            by: 'game',
          },
        });
        await repos.cells.replaceAll(group.id, [cell]);
        expect(await repos.cells.get(group.id, 0)).toEqual(cell);
      });

      it('should return undefined for an unknown day', async () => {
        expect(await repos.cells.get('nope', 0)).toBeUndefined();
      });

      it('should not change a cell whose state differs from the expected one', async () => {
        const group = aGroup();
        await repos.cells.replaceAll(group.id, [aCell(group.id, 0)]);
        expect(await repos.cells.transition(group.id, 0, 'picking', { state: 'open' })).toBe(false);
        expect((await repos.cells.get(group.id, 0))?.state).toBe('closed');
      });

      it('should let exactly one of ten parallel transitions win', async () => {
        const group = aGroup();
        await repos.cells.replaceAll(group.id, [aCell(group.id, 0)]);
        const results = await Promise.all(
          Array.from({ length: 10 }, () =>
            repos.cells.transition(group.id, 0, 'closed', { state: 'open', openedAt: new Date() }),
          ),
        );
        expect(results.filter(Boolean)).toHaveLength(1);
      });

      describe('openBySpin', () => {
        const spinPatch = (extra: object = {}) => ({
          state: 'open' as const,
          openedAt: new Date(Date.UTC(2026, 11, 1, 7)),
          spin: {
            startAt: new Date(Date.UTC(2026, 11, 1, 7)),
            durationMs: 5000,
            doors: [0, 2],
            winnerIndex: 1,
            by: 'game' as const,
          },
          ...extra,
        });

        it('should open the day and swap the tasks of the day and the winning door in one step', async () => {
          const group = aGroup();
          await repos.cells.replaceAll(group.id, [
            aCell(group.id, 0, { state: 'picking' }),
            aCell(group.id, 1),
            aCell(group.id, 2),
          ]);
          expect(await repos.cells.openBySpin(group.id, 0, 'picking', 2, spinPatch())).toBe('won');
          const [today, middle, winner] = await repos.cells.list(group.id);
          expect(today.state).toBe('open');
          expect(today.task).toEqual({ kind: 'catalog', taskId: 'task-2' });
          expect(middle.task).toEqual({ kind: 'catalog', taskId: 'task-1' });
          expect(winner.task).toEqual({ kind: 'catalog', taskId: 'task-0' });
          expect(winner.state).toBe('closed');
        });

        it('should keep the task when the day itself is the winning door', async () => {
          const group = aGroup();
          await repos.cells.replaceAll(group.id, [aCell(group.id, 0, { state: 'picking' }), aCell(group.id, 1)]);
          expect(await repos.cells.openBySpin(group.id, 0, 'picking', 0, spinPatch())).toBe('won');
          expect((await repos.cells.get(group.id, 0))?.task).toEqual({ kind: 'catalog', taskId: 'task-0' });
        });

        it('should lose when the day is no longer in the expected state, changing nothing', async () => {
          const group = aGroup();
          await repos.cells.replaceAll(group.id, [aCell(group.id, 0, { state: 'open' }), aCell(group.id, 1)]);
          expect(await repos.cells.openBySpin(group.id, 0, 'picking', 1, spinPatch())).toBe('lost');
          expect((await repos.cells.get(group.id, 1))?.task).toEqual({ kind: 'catalog', taskId: 'task-1' });
        });

        it('should ask for a new wheel when the winning door has opened meanwhile, changing nothing', async () => {
          const group = aGroup();
          await repos.cells.replaceAll(group.id, [
            aCell(group.id, 0, { state: 'picking' }),
            aCell(group.id, 1, { state: 'open' }),
          ]);
          expect(await repos.cells.openBySpin(group.id, 0, 'picking', 1, spinPatch())).toBe('retry');
          expect((await repos.cells.get(group.id, 0))?.state).toBe('picking');
          expect((await repos.cells.get(group.id, 1))?.task).toEqual({ kind: 'catalog', taskId: 'task-1' });
        });

        it('should never duplicate or lose a task when spins race for the same winning door', async () => {
          const group = aGroup();
          await repos.cells.replaceAll(group.id, [
            aCell(group.id, 0, { state: 'picking' }),
            aCell(group.id, 1, { state: 'picking' }),
            aCell(group.id, 2),
          ]);
          const results = await Promise.all([
            repos.cells.openBySpin(group.id, 0, 'picking', 2, spinPatch()),
            repos.cells.openBySpin(group.id, 1, 'picking', 2, spinPatch()),
          ]);
          // The winning door stays closed after a swap, so both may win; what must hold is that no task is lost or doubled.
          expect(results).toEqual(['won', 'won']);
          const ids = (await repos.cells.list(group.id)).map((cell) =>
            cell.task.kind === 'catalog' ? cell.task.taskId : '',
          );
          expect([...ids].sort()).toEqual(['task-0', 'task-1', 'task-2']);
        });
      });

      it('should clear a field patched with undefined', async () => {
        const group = aGroup();
        await repos.cells.replaceAll(group.id, [aCell(group.id, 0, { state: 'picking', pickerMemberId: 'm1' })]);
        await repos.cells.transition(group.id, 0, 'picking', { state: 'open', pickerMemberId: undefined });
        expect((await repos.cells.get(group.id, 0))?.pickerMemberId).toBeUndefined();
      });

      it('should swap the tasks of two days, and only when the guard allows it', async () => {
        const group = aGroup();
        await repos.cells.replaceAll(group.id, [aCell(group.id, 0), aCell(group.id, 1)]);
        expect(await repos.cells.swapTasks(group.id, 0, 1, () => false)).toBe(false);
        expect((await repos.cells.get(group.id, 0))?.task).toEqual({ kind: 'catalog', taskId: 'task-0' });
        expect(await repos.cells.swapTasks(group.id, 0, 1, () => true)).toBe(true);
        expect((await repos.cells.get(group.id, 0))?.task).toEqual({ kind: 'catalog', taskId: 'task-1' });
        expect((await repos.cells.get(group.id, 1))?.task).toEqual({ kind: 'catalog', taskId: 'task-0' });
      });

      it('should change the group status only from the expected one, once under concurrency', async () => {
        const group = aGroup();
        await repos.groups.create(group);
        expect(await repos.groups.setStatus(group.id, 'active', 'finished')).toBe(false);
        expect(await repos.groups.setStatus(group.id, 'draft', 'active')).toBe(true);
        expect((await repos.groups.get(group.id))?.status).toBe('active');
        const results = await Promise.all(
          Array.from({ length: 5 }, () => repos.groups.setStatus(group.id, 'active', 'finished')),
        );
        expect(results.filter(Boolean)).toHaveLength(1);
        expect((await repos.groups.get(group.id))?.status).toBe('finished');
      });

      it('should list only groups with a game in the asked statuses', async () => {
        const game = {
          startDate: '2026-12-01',
          days: 7,
          openTime: '09:00',
          mode: 'auto' as const,
          categories: ['home' as const],
        };
        const draft = aGroup({ game });
        const active = aGroup({ game, status: 'active' });
        const finished = aGroup({ game, status: 'finished' });
        const noGame = aGroup();
        for (const group of [draft, active, finished, noGame]) {
          await repos.groups.create(group);
        }
        const ids = (await repos.groups.listWithGame(['draft', 'active'])).map((group) => group.id);
        expect(ids).toEqual(expect.arrayContaining([draft.id, active.id]));
        expect(ids).not.toContain(finished.id);
        expect(ids).not.toContain(noGame.id);
      });

      it('should list only the groups of the asked owner', async () => {
        const mine = aGroup({ ownerUid: 'owner-list-1' });
        const alsoMine = aGroup({ ownerUid: 'owner-list-1' });
        const other = aGroup({ ownerUid: 'owner-list-2' });
        for (const group of [mine, alsoMine, other]) {
          await repos.groups.create(group);
        }
        const ids = (await repos.groups.listByOwner('owner-list-1')).map((group) => group.id);
        expect(ids.sort()).toEqual([mine.id, alsoMine.id].sort());
        expect(await repos.groups.listByOwner('owner-nobody')).toEqual([]);
      });

      it('should store and read the game settings of a group', async () => {
        const group = aGroup();
        await repos.groups.create(group);
        const game = {
          startDate: '2026-12-01',
          days: 14,
          openTime: '09:00',
          mode: 'roulette' as const,
          categories: ['home' as const, 'kids' as const],
        };
        await repos.groups.update(group.id, { game });
        expect((await repos.groups.get(group.id))?.game).toEqual(game);
      });
    });
  });
}
