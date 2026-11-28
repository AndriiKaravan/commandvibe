import {
  Cell,
  CellState,
  Comment,
  Complaint,
  Like,
  Group,
  GroupStatus,
  Member,
  MemberSecrets,
  Organizer,
  Session,
  Submission,
} from '../models';
import { nextPinAttempt } from '../pin-attempts';
import {
  CellRepository,
  CommentRepository,
  ComplaintRepository,
  LikeRepository,
  GroupRepository,
  SubmissionRepository,
  MemberRepository,
  NameTakenError,
  OrganizerRepository,
  PinAttempt,
  SessionRepository,
} from '../repositories';

// structuredClone keeps callers from mutating stored state, like a real database would.
const copy = <T>(value: T): T => structuredClone(value);

class MemoryOrganizers implements OrganizerRepository {
  private readonly items = new Map<string, Organizer>();

  async upsert(organizer: Organizer): Promise<void> {
    this.items.set(organizer.uid, copy(organizer));
  }

  async get(uid: string): Promise<Organizer | undefined> {
    const item = this.items.get(uid);
    return item && copy(item);
  }
}

class MemorySessions implements SessionRepository {
  private readonly items = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.items.set(session.id, copy(session));
  }

  async get(id: string): Promise<Session | undefined> {
    const item = this.items.get(id);
    return item && copy(item);
  }

  async update(id: string, patch: Partial<Omit<Session, 'id'>>): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      this.items.set(id, { ...item, ...copy(patch) });
    }
  }

  async rotateRefresh(id: string, expectedHash: string, nextHash: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item || item.revokedAt || item.refreshTokenHash !== expectedHash) {
      return false;
    }
    this.items.set(id, { ...item, refreshTokenHash: nextHash });
    return true;
  }

  async revokeAllFor(subjectId: string, at: Date): Promise<void> {
    for (const [id, session] of this.items) {
      if (session.subject.id === subjectId && !session.revokedAt) {
        this.items.set(id, { ...session, revokedAt: new Date(at) });
      }
    }
  }
}

class MemoryGroups implements GroupRepository {
  private readonly items = new Map<string, Group>();

  async create(group: Group): Promise<void> {
    this.items.set(group.id, copy(group));
  }

  async get(id: string): Promise<Group | undefined> {
    const item = this.items.get(id);
    return item && copy(item);
  }

  async update(id: string, patch: Partial<Omit<Group, 'id'>>): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      this.items.set(id, { ...item, ...copy(patch) });
    }
  }

  async listWithGame(statuses: GroupStatus[]): Promise<Group[]> {
    return [...this.items.values()].filter((group) => group.game && statuses.includes(group.status)).map(copy);
  }

  async listByOwner(ownerUid: string): Promise<Group[]> {
    return [...this.items.values()].filter((group) => group.ownerUid === ownerUid).map(copy);
  }

  async setStatus(id: string, expected: GroupStatus, next: GroupStatus): Promise<boolean> {
    const item = this.items.get(id);
    if (!item || item.status !== expected) {
      return false;
    }
    this.items.set(id, { ...item, status: next });
    return true;
  }

  async findByInviteHash(hash: string): Promise<Group | undefined> {
    const item = [...this.items.values()].find((group) => group.inviteTokenHash === hash);
    return item && copy(item);
  }
}

class MemoryMembers implements MemberRepository {
  private readonly items = new Map<string, Member>();
  private readonly secretsById = new Map<string, MemberSecrets>();

  async createUnique(member: Member): Promise<Member> {
    if (this.nameTaken(member.groupId, member.nameKey, member.id)) {
      throw new NameTakenError();
    }
    this.items.set(member.id, copy(member));
    return copy(member);
  }

  async get(groupId: string, id: string): Promise<Member | undefined> {
    const item = this.items.get(id);
    return item && item.groupId === groupId ? copy(item) : undefined;
  }

  async findByName(groupId: string, nameKey: string): Promise<Member | undefined> {
    const item = [...this.items.values()].find((m) => m.groupId === groupId && m.nameKey === nameKey);
    return item && copy(item);
  }

  async list(groupId: string): Promise<Member[]> {
    return [...this.items.values()].filter((m) => m.groupId === groupId).map(copy);
  }

  async update(groupId: string, id: string, patch: Partial<Omit<Member, 'id' | 'groupId'>>): Promise<void> {
    const item = this.items.get(id);
    if (!item || item.groupId !== groupId) {
      return;
    }
    if (patch.nameKey && this.nameTaken(groupId, patch.nameKey, id)) {
      throw new NameTakenError();
    }
    this.items.set(id, { ...item, ...copy(patch) });
  }

  // No await between read and write, so this is atomic on the event loop.
  async reservePinAttempt(groupId: string, id: string, now: Date, max: number, lockMs: number): Promise<PinAttempt> {
    const key = `${groupId}/${id}`;
    const secrets = this.secretsById.get(key) ?? { pinFailures: 0 };
    const next = nextPinAttempt(secrets, now, max, lockMs);
    if (next.kind === 'attempt') {
      this.secretsById.set(key, { ...secrets, ...next.patch });
      return { kind: 'attempt', attempt: next.attempt, pinHash: secrets.pinHash };
    }
    return next;
  }

  async secrets(groupId: string, id: string): Promise<MemberSecrets> {
    return copy(this.secretsById.get(`${groupId}/${id}`) ?? { pinFailures: 0 });
  }

  async updateSecrets(groupId: string, id: string, patch: Partial<MemberSecrets>): Promise<void> {
    const key = `${groupId}/${id}`;
    this.secretsById.set(key, { ...(this.secretsById.get(key) ?? { pinFailures: 0 }), ...copy(patch) });
  }

  private nameTaken(groupId: string, nameKey: string, exceptId: string): boolean {
    return [...this.items.values()].some((m) => m.groupId === groupId && m.nameKey === nameKey && m.id !== exceptId);
  }
}

class MemoryCells implements CellRepository {
  private readonly items = new Map<string, Cell>();

  private key = (groupId: string, dayIndex: number): string => `${groupId}/${dayIndex}`;

  async list(groupId: string): Promise<Cell[]> {
    return [...this.items.values()]
      .filter((cell) => cell.groupId === groupId)
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map(copy);
  }

  async get(groupId: string, dayIndex: number): Promise<Cell | undefined> {
    const item = this.items.get(this.key(groupId, dayIndex));
    return item && copy(item);
  }

  async replaceAll(groupId: string, cells: Cell[]): Promise<void> {
    for (const cell of [...this.items.values()].filter((item) => item.groupId === groupId)) {
      this.items.delete(this.key(groupId, cell.dayIndex));
    }
    for (const cell of cells) {
      this.items.set(this.key(groupId, cell.dayIndex), copy(cell));
    }
  }

  async transition(
    groupId: string,
    dayIndex: number,
    expected: CellState,
    patch: Partial<Omit<Cell, 'groupId' | 'dayIndex'>>,
  ): Promise<boolean> {
    const item = this.items.get(this.key(groupId, dayIndex));
    if (!item || item.state !== expected) {
      return false;
    }
    const next: Cell = { ...item, ...copy(patch) };
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined) {
        delete (next as unknown as Record<string, unknown>)[field];
      }
    }
    this.items.set(this.key(groupId, dayIndex), next);
    return true;
  }

  async openBySpin(
    groupId: string,
    day: number,
    expected: CellState,
    winnerDay: number,
    patch: Partial<Omit<Cell, 'groupId' | 'dayIndex' | 'task'>>,
  ): Promise<'won' | 'lost' | 'retry'> {
    const current = this.items.get(this.key(groupId, day));
    if (!current || current.state !== expected) {
      return 'lost';
    }
    const winner = this.items.get(this.key(groupId, winnerDay));
    if (!winner || (winnerDay !== day && winner.state !== 'closed')) {
      return 'retry';
    }
    this.items.set(this.key(groupId, day), { ...current, ...copy(patch), task: winner.task });
    if (winnerDay !== day) {
      this.items.set(this.key(groupId, winnerDay), { ...winner, task: current.task });
    }
    return 'won';
  }

  async swapTasks(
    groupId: string,
    a: number,
    b: number,
    onlyIf: (cellA: Cell, cellB: Cell) => boolean,
  ): Promise<boolean> {
    const first = this.items.get(this.key(groupId, a));
    const second = this.items.get(this.key(groupId, b));
    if (!first || !second || !onlyIf(copy(first), copy(second))) {
      return false;
    }
    this.items.set(this.key(groupId, a), { ...first, task: second.task });
    this.items.set(this.key(groupId, b), { ...second, task: first.task });
    return true;
  }

  async markRevealed(groupId: string, dayIndex: number, at: Date): Promise<boolean> {
    const item = this.items.get(this.key(groupId, dayIndex));
    if (!item || item.revealedAt) {
      return false;
    }
    this.items.set(this.key(groupId, dayIndex), { ...item, revealedAt: new Date(at) });
    return true;
  }
}

class MemorySubmissions implements SubmissionRepository {
  private readonly items = new Map<string, Submission>();

  private key = (groupId: string, dayIndex: number, memberId: string): string => `${groupId}/${dayIndex}/${memberId}`;

  async get(groupId: string, dayIndex: number, memberId: string): Promise<Submission | undefined> {
    const item = this.items.get(this.key(groupId, dayIndex, memberId));
    return item && copy(item);
  }

  async listDay(groupId: string, dayIndex: number): Promise<Submission[]> {
    return [...this.items.values()].filter((s) => s.groupId === groupId && s.dayIndex === dayIndex).map(copy);
  }

  async listByGroup(groupId: string, days: number): Promise<Submission[]> {
    return [...this.items.values()].filter((s) => s.groupId === groupId && s.dayIndex < days).map(copy);
  }

  async listMember(groupId: string, memberId: string, days: number): Promise<Submission[]> {
    return [...this.items.values()]
      .filter((s) => s.groupId === groupId && s.memberId === memberId && s.dayIndex < days)
      .map(copy);
  }

  // No await between read and write, so this is atomic on the event loop.
  async put(submission: Submission, expectedVersion: string | null): Promise<'created' | 'replaced' | 'conflict'> {
    const key = this.key(submission.groupId, submission.dayIndex, submission.memberId);
    const current = this.items.get(key);
    if (expectedVersion === null ? current : current?.version !== expectedVersion || current.status === 'hidden') {
      return 'conflict';
    }
    this.items.set(key, copy(submission));
    return current ? 'replaced' : 'created';
  }

  async setStatus(
    groupId: string,
    dayIndex: number,
    memberId: string,
    status: Submission['status'],
    at: Date,
  ): Promise<boolean> {
    const key = this.key(groupId, dayIndex, memberId);
    const current = this.items.get(key);
    if (!current) {
      return false;
    }
    const next: Submission = { ...current, status, hiddenAt: status === 'hidden' ? at : undefined };
    if (status === 'visible') {
      delete next.hiddenAt;
    }
    this.items.set(key, next);
    return true;
  }

  async delete(groupId: string, dayIndex: number, memberId: string): Promise<void> {
    this.items.delete(this.key(groupId, dayIndex, memberId));
  }
}

class MemoryComments implements CommentRepository {
  private readonly items = new Map<string, Comment>();

  private key = (groupId: string, id: string): string => `${groupId}/${id}`;

  async add(comment: Comment): Promise<void> {
    this.items.set(this.key(comment.groupId, comment.id), copy(comment));
  }

  async get(groupId: string, id: string): Promise<Comment | undefined> {
    const found = this.items.get(this.key(groupId, id));
    return found && copy(found);
  }

  async listForPhoto(groupId: string, dayIndex: number, authorMemberId: string): Promise<Comment[]> {
    return [...this.items.values()]
      .filter((c) => c.groupId === groupId && c.dayIndex === dayIndex && c.authorMemberId === authorMemberId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1))
      .map(copy);
  }

  async countsByGroup(groupId: string): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const c of this.items.values()) {
      if (c.groupId === groupId) {
        const key = `${c.dayIndex}/${c.authorMemberId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }

  async delete(groupId: string, id: string): Promise<void> {
    this.items.delete(this.key(groupId, id));
  }

  async deleteForPhoto(groupId: string, dayIndex: number, authorMemberId: string): Promise<void> {
    for (const [key, c] of this.items) {
      if (c.groupId === groupId && c.dayIndex === dayIndex && c.authorMemberId === authorMemberId) {
        this.items.delete(key);
      }
    }
  }

  async deleteInvolving(groupId: string, memberId: string): Promise<void> {
    for (const [key, c] of this.items) {
      if (c.groupId === groupId && (c.memberId === memberId || c.authorMemberId === memberId)) {
        this.items.delete(key);
      }
    }
  }
}

class MemoryLikes implements LikeRepository {
  private readonly items = new Map<string, Like>();

  private key = (groupId: string, dayIndex: number, author: string, liker: string): string =>
    `${groupId}/${dayIndex}/${author}/${liker}`;

  async add(like: Like): Promise<boolean> {
    const key = this.key(like.groupId, like.dayIndex, like.authorMemberId, like.likerMemberId);
    if (this.items.has(key)) {
      return false;
    }
    this.items.set(key, copy(like));
    return true;
  }

  async remove(groupId: string, dayIndex: number, authorMemberId: string, likerMemberId: string): Promise<boolean> {
    return this.items.delete(this.key(groupId, dayIndex, authorMemberId, likerMemberId));
  }

  async listByGroup(groupId: string): Promise<Like[]> {
    return [...this.items.values()].filter((l) => l.groupId === groupId).map(copy);
  }

  async listByDay(groupId: string, dayIndex: number): Promise<Like[]> {
    return [...this.items.values()].filter((l) => l.groupId === groupId && l.dayIndex === dayIndex).map(copy);
  }

  async deleteForPhoto(groupId: string, dayIndex: number, authorMemberId: string): Promise<void> {
    for (const [key, l] of this.items) {
      if (l.groupId === groupId && l.dayIndex === dayIndex && l.authorMemberId === authorMemberId) {
        this.items.delete(key);
      }
    }
  }

  async deleteInvolving(groupId: string, memberId: string): Promise<void> {
    for (const [key, l] of this.items) {
      if (l.groupId === groupId && (l.authorMemberId === memberId || l.likerMemberId === memberId)) {
        this.items.delete(key);
      }
    }
  }
}

class MemoryComplaints implements ComplaintRepository {
  private readonly items = new Map<string, Complaint>();

  private key = (c: Pick<Complaint, 'groupId' | 'id'>): string => `${c.groupId}/${c.id}`;

  async add(complaint: Complaint): Promise<boolean> {
    const existing = this.items.get(this.key(complaint));
    if (existing?.status === 'open') {
      return false;
    }
    // A complaint closed earlier counts again when the same person complains anew.
    this.items.set(this.key(complaint), copy(complaint));
    return true;
  }

  async listOpen(groupId: string): Promise<Complaint[]> {
    return [...this.items.values()].filter((c) => c.groupId === groupId && c.status === 'open').map(copy);
  }

  async openCount(groupId: string, dayIndex: number, authorMemberId: string): Promise<number> {
    return [...this.items.values()].filter(
      (c) =>
        c.groupId === groupId && c.dayIndex === dayIndex && c.authorMemberId === authorMemberId && c.status === 'open',
    ).length;
  }

  async resolve(groupId: string, dayIndex: number, authorMemberId: string, at: Date): Promise<number> {
    let closed = 0;
    for (const [key, c] of this.items) {
      if (
        c.groupId === groupId &&
        c.dayIndex === dayIndex &&
        c.authorMemberId === authorMemberId &&
        c.status === 'open'
      ) {
        this.items.set(key, { ...c, status: 'resolved', resolvedAt: at });
        closed++;
      }
    }
    return closed;
  }

  async deleteInvolving(groupId: string, memberId: string): Promise<void> {
    for (const [key, c] of this.items) {
      if (c.groupId === groupId && (c.authorMemberId === memberId || c.complainerMemberId === memberId)) {
        this.items.delete(key);
      }
    }
  }
}

export function createMemoryRepositories(): {
  cells: CellRepository;
  organizers: OrganizerRepository;
  sessions: SessionRepository;
  groups: GroupRepository;
  members: MemberRepository;
  submissions: SubmissionRepository;
  complaints: ComplaintRepository;
  likes: LikeRepository;
  comments: CommentRepository;
} {
  return {
    comments: new MemoryComments(),
    likes: new MemoryLikes(),
    submissions: new MemorySubmissions(),
    complaints: new MemoryComplaints(),
    cells: new MemoryCells(),
    organizers: new MemoryOrganizers(),
    sessions: new MemorySessions(),
    groups: new MemoryGroups(),
    members: new MemoryMembers(),
  };
}
