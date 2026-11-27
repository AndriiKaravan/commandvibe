import { createHash } from 'node:crypto';
import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  Cell,
  CellState,
  Complaint,
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
  ComplaintRepository,
  GroupRepository,
  SubmissionRepository,
  MemberRepository,
  NameTakenError,
  OrganizerRepository,
  PinAttempt,
  SessionRepository,
} from '../repositories';

type Stored = Record<string, unknown>;

/** Firestore keeps dates as Timestamps; the rest of the server sees Dates. */
function fromStore<T>(data: Stored | undefined): T | undefined {
  if (!data) {
    return undefined;
  }
  return convert(data, (value) => (value instanceof Timestamp ? value.toDate() : undefined)) as T;
}

function toStore(data: object): Stored {
  return convert(data, (value) => (value instanceof Date ? Timestamp.fromDate(value) : undefined)) as Stored;
}

/** Like [toStore], but a key patched with `undefined` deletes the stored field. */
function toPatch(patch: object): Stored {
  const stored = toStore(patch);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      stored[key] = FieldValue.delete();
    }
  }
  return stored;
}

function convert(value: unknown, leaf: (value: unknown) => unknown): unknown {
  const replaced = leaf(value);
  if (replaced !== undefined) {
    return replaced;
  }
  if (Array.isArray(value)) {
    return value.map((item) => convert(item, leaf));
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, convert(item, leaf)]),
    );
  }
  return value;
}

// Name keys are free text ('.', '..', '__x__' are invalid document ids); a hash never is.
const nameDocId = (nameKey: string): string => createHash('sha256').update(nameKey).digest('hex');

class FirestoreOrganizers implements OrganizerRepository {
  constructor(private readonly db: Firestore) {}

  async upsert(organizer: Organizer): Promise<void> {
    await this.db.doc(`organizers/${organizer.uid}`).set(toStore(organizer), { merge: true });
  }

  async get(uid: string): Promise<Organizer | undefined> {
    return fromStore<Organizer>((await this.db.doc(`organizers/${uid}`).get()).data());
  }
}

class FirestoreSessions implements SessionRepository {
  constructor(private readonly db: Firestore) {}

  async create(session: Session): Promise<void> {
    await this.db.doc(`sessions/${session.id}`).create(toStore(session));
  }

  async get(id: string): Promise<Session | undefined> {
    return fromStore<Session>((await this.db.doc(`sessions/${id}`).get()).data());
  }

  async update(id: string, patch: Partial<Omit<Session, 'id'>>): Promise<void> {
    await this.db.doc(`sessions/${id}`).update(toPatch(patch));
  }

  async rotateRefresh(id: string, expectedHash: string, nextHash: string): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.db.doc(`sessions/${id}`);
      const current = (await tx.get(ref)).data();
      if (!current || current.revokedAt || current.refreshTokenHash !== expectedHash) {
        return false;
      }
      tx.update(ref, { refreshTokenHash: nextHash });
      return true;
    });
  }

  async revokeAllFor(subjectId: string, at: Date): Promise<void> {
    const open = await this.db.collection('sessions').where('subject.id', '==', subjectId).get();
    const batch = this.db.batch();
    for (const doc of open.docs) {
      if (!doc.get('revokedAt')) {
        batch.update(doc.ref, { revokedAt: Timestamp.fromDate(at) });
      }
    }
    await batch.commit();
  }
}

class FirestoreGroups implements GroupRepository {
  constructor(private readonly db: Firestore) {}

  async create(group: Group): Promise<void> {
    await this.db.doc(`groups/${group.id}`).create(toStore(group));
  }

  async get(id: string): Promise<Group | undefined> {
    return fromStore<Group>((await this.db.doc(`groups/${id}`).get()).data());
  }

  async update(id: string, patch: Partial<Omit<Group, 'id'>>): Promise<void> {
    await this.db.doc(`groups/${id}`).update(toPatch(patch));
  }

  async listWithGame(statuses: GroupStatus[]): Promise<Group[]> {
    const found = await this.db.collection('groups').where('status', 'in', statuses).get();
    return found.docs.map((doc) => fromStore<Group>(doc.data()) as Group).filter((group) => group.game);
  }

  async listByOwner(ownerUid: string): Promise<Group[]> {
    const found = await this.db.collection('groups').where('ownerUid', '==', ownerUid).get();
    return found.docs.map((doc) => fromStore<Group>(doc.data()) as Group);
  }

  async setStatus(id: string, expected: GroupStatus, next: GroupStatus): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.db.doc(`groups/${id}`);
      if ((await tx.get(ref)).data()?.status !== expected) {
        return false;
      }
      tx.update(ref, { status: next });
      return true;
    });
  }

  async findByInviteHash(hash: string): Promise<Group | undefined> {
    const found = await this.db.collection('groups').where('inviteTokenHash', '==', hash).limit(1).get();
    return fromStore<Group>(found.docs[0]?.data());
  }
}

class FirestoreMembers implements MemberRepository {
  constructor(private readonly db: Firestore) {}

  private memberRef(groupId: string, id: string) {
    return this.db.doc(`groups/${groupId}/members/${id}`);
  }

  private nameRef(groupId: string, nameKey: string) {
    return this.db.doc(`groups/${groupId}/nameIndex/${nameDocId(nameKey)}`);
  }

  private secretsRef(groupId: string, id: string) {
    return this.db.doc(`groups/${groupId}/members/${id}/private/secrets`);
  }

  async createUnique(member: Member): Promise<Member> {
    await this.db.runTransaction(async (tx) => {
      const name = await tx.get(this.nameRef(member.groupId, member.nameKey));
      if (name.exists) {
        throw new NameTakenError();
      }
      tx.create(this.nameRef(member.groupId, member.nameKey), { memberId: member.id });
      tx.create(this.memberRef(member.groupId, member.id), toStore(member));
    });
    return member;
  }

  async get(groupId: string, id: string): Promise<Member | undefined> {
    return fromStore<Member>((await this.memberRef(groupId, id).get()).data());
  }

  async findByName(groupId: string, nameKey: string): Promise<Member | undefined> {
    const name = await this.nameRef(groupId, nameKey).get();
    const memberId = name.get('memberId') as string | undefined;
    return memberId ? this.get(groupId, memberId) : undefined;
  }

  async list(groupId: string): Promise<Member[]> {
    const docs = await this.db.collection(`groups/${groupId}/members`).get();
    return docs.docs.map((doc) => fromStore<Member>(doc.data()) as Member);
  }

  async update(groupId: string, id: string, patch: Partial<Omit<Member, 'id' | 'groupId'>>): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const current = fromStore<Member>((await tx.get(this.memberRef(groupId, id))).data());
      if (!current) {
        return;
      }
      if (patch.nameKey && patch.nameKey !== current.nameKey) {
        const taken = await tx.get(this.nameRef(groupId, patch.nameKey));
        if (taken.exists) {
          throw new NameTakenError();
        }
        tx.delete(this.nameRef(groupId, current.nameKey));
        tx.create(this.nameRef(groupId, patch.nameKey), { memberId: id });
      }
      tx.update(this.memberRef(groupId, id), toPatch(patch));
    });
  }

  async reservePinAttempt(groupId: string, id: string, now: Date, max: number, lockMs: number): Promise<PinAttempt> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.secretsRef(groupId, id);
      const secrets: MemberSecrets = { pinFailures: 0, ...fromStore<MemberSecrets>((await tx.get(ref)).data()) };
      const next = nextPinAttempt(secrets, now, max, lockMs);
      if (next.kind === 'locked') {
        return next;
      }
      tx.set(ref, toPatch(next.patch), { merge: true });
      return { kind: 'attempt', attempt: next.attempt, pinHash: secrets.pinHash };
    });
  }

  async secrets(groupId: string, id: string): Promise<MemberSecrets> {
    const data = fromStore<MemberSecrets>((await this.secretsRef(groupId, id).get()).data());
    return { pinFailures: 0, ...data };
  }

  async updateSecrets(groupId: string, id: string, patch: Partial<MemberSecrets>): Promise<void> {
    await this.secretsRef(groupId, id).set(toPatch(patch), { merge: true });
  }
}

class FirestoreCells implements CellRepository {
  constructor(private readonly db: Firestore) {}

  // Two digits keep the ids in day order (a month is at most 31 days).
  private ref(groupId: string, dayIndex: number) {
    return this.db.doc(`groups/${groupId}/cells/${String(dayIndex).padStart(2, '0')}`);
  }

  async list(groupId: string): Promise<Cell[]> {
    const found = await this.db.collection(`groups/${groupId}/cells`).orderBy('dayIndex').get();
    return found.docs.map((doc) => fromStore<Cell>(doc.data()) as Cell);
  }

  async get(groupId: string, dayIndex: number): Promise<Cell | undefined> {
    return fromStore<Cell>((await this.ref(groupId, dayIndex).get()).data());
  }

  async replaceAll(groupId: string, cells: Cell[]): Promise<void> {
    const batch = this.db.batch();
    const existing = await this.db.collection(`groups/${groupId}/cells`).get();
    existing.docs.forEach((doc) => batch.delete(doc.ref));
    cells.forEach((cell) => batch.set(this.ref(groupId, cell.dayIndex), toStore(cell)));
    await batch.commit();
  }

  async transition(
    groupId: string,
    dayIndex: number,
    expected: CellState,
    patch: Partial<Omit<Cell, 'groupId' | 'dayIndex'>>,
  ): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.ref(groupId, dayIndex);
      const current = fromStore<Cell>((await tx.get(ref)).data());
      if (!current || current.state !== expected) {
        return false;
      }
      tx.update(ref, toPatch(patch));
      return true;
    });
  }

  async openBySpin(
    groupId: string,
    day: number,
    expected: CellState,
    winnerDay: number,
    patch: Partial<Omit<Cell, 'groupId' | 'dayIndex' | 'task'>>,
  ): Promise<'won' | 'lost' | 'retry'> {
    return this.db.runTransaction(async (tx) => {
      const dayRef = this.ref(groupId, day);
      const winnerRef = this.ref(groupId, winnerDay);
      const [daySnap, winnerSnap] = await Promise.all([
        tx.get(dayRef),
        winnerDay === day ? undefined : tx.get(winnerRef),
      ]);
      const current = fromStore<Cell>(daySnap.data());
      if (!current || current.state !== expected) {
        return 'lost';
      }
      const winner = winnerSnap ? fromStore<Cell>(winnerSnap.data()) : current;
      if (!winner || (winnerDay !== day && winner.state !== 'closed')) {
        return 'retry';
      }
      tx.update(dayRef, toPatch({ ...patch, task: winner.task }));
      if (winnerDay !== day) {
        tx.update(winnerRef, toPatch({ task: current.task }));
      }
      return 'won';
    });
  }

  async swapTasks(
    groupId: string,
    a: number,
    b: number,
    onlyIf: (cellA: Cell, cellB: Cell) => boolean,
  ): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const refA = this.ref(groupId, a);
      const refB = this.ref(groupId, b);
      const [first, second] = (await Promise.all([tx.get(refA), tx.get(refB)])).map((snap) =>
        fromStore<Cell>(snap.data()),
      );
      if (!first || !second || !onlyIf(first, second)) {
        return false;
      }
      tx.update(refA, toPatch({ task: second.task }));
      tx.update(refB, toPatch({ task: first.task }));
      return true;
    });
  }

  async markRevealed(groupId: string, dayIndex: number, at: Date): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.ref(groupId, dayIndex);
      const current = fromStore<Cell>((await tx.get(ref)).data());
      if (!current || current.revealedAt) {
        return false;
      }
      tx.update(ref, toPatch({ revealedAt: at }));
      return true;
    });
  }
}

const dayId = (dayIndex: number): string => String(dayIndex).padStart(2, '0');

class FirestoreSubmissions implements SubmissionRepository {
  constructor(private readonly db: Firestore) {}

  private ref(groupId: string, dayIndex: number, memberId: string) {
    return this.db.doc(`groups/${groupId}/cells/${dayId(dayIndex)}/submissions/${memberId}`);
  }

  async get(groupId: string, dayIndex: number, memberId: string): Promise<Submission | undefined> {
    return fromStore<Submission>((await this.ref(groupId, dayIndex, memberId).get()).data());
  }

  async listDay(groupId: string, dayIndex: number): Promise<Submission[]> {
    const found = await this.db.collection(`groups/${groupId}/cells/${dayId(dayIndex)}/submissions`).get();
    return found.docs.map((doc) => fromStore<Submission>(doc.data()) as Submission);
  }

  async listMember(groupId: string, memberId: string, days: number): Promise<Submission[]> {
    if (days <= 0) {
      return [];
    }
    const refs = Array.from({ length: days }, (_, day) => this.ref(groupId, day, memberId));
    const snaps = await this.db.getAll(...refs);
    return snaps.filter((snap) => snap.exists).map((snap) => fromStore<Submission>(snap.data()) as Submission);
  }

  async put(submission: Submission, expectedVersion: string | null): Promise<'created' | 'replaced' | 'conflict'> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.ref(submission.groupId, submission.dayIndex, submission.memberId);
      const current = fromStore<Submission>((await tx.get(ref)).data());
      if (expectedVersion === null ? current : current?.version !== expectedVersion || current.status === 'hidden') {
        return 'conflict';
      }
      tx.set(ref, toStore(submission));
      return current ? 'replaced' : 'created';
    });
  }

  async setStatus(
    groupId: string,
    dayIndex: number,
    memberId: string,
    status: Submission['status'],
    at: Date,
  ): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.ref(groupId, dayIndex, memberId);
      if (!(await tx.get(ref)).exists) {
        return false;
      }
      tx.update(ref, toPatch({ status, hiddenAt: status === 'hidden' ? at : undefined }));
      return true;
    });
  }

  async delete(groupId: string, dayIndex: number, memberId: string): Promise<void> {
    await this.ref(groupId, dayIndex, memberId).delete();
  }
}

class FirestoreComplaints implements ComplaintRepository {
  constructor(private readonly db: Firestore) {}

  private collection(groupId: string) {
    return this.db.collection(`groups/${groupId}/complaints`);
  }

  async add(complaint: Complaint): Promise<boolean> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.collection(complaint.groupId).doc(complaint.id);
      const existing = fromStore<Complaint>((await tx.get(ref)).data());
      if (existing?.status === 'open') {
        return false;
      }
      // A complaint closed earlier counts again when the same person complains anew.
      tx.set(ref, toStore(complaint));
      return true;
    });
  }

  async listOpen(groupId: string): Promise<Complaint[]> {
    const found = await this.collection(groupId).where('status', '==', 'open').get();
    return found.docs.map((doc) => fromStore<Complaint>(doc.data()) as Complaint);
  }

  async openCount(groupId: string, dayIndex: number, authorMemberId: string): Promise<number> {
    return (await this.listOpen(groupId)).filter((c) => c.dayIndex === dayIndex && c.authorMemberId === authorMemberId)
      .length;
  }

  async resolve(groupId: string, dayIndex: number, authorMemberId: string, at: Date): Promise<number> {
    const found = await this.collection(groupId).where('status', '==', 'open').get();
    const matching = found.docs.filter((doc) => {
      const c = doc.data();
      return c.dayIndex === dayIndex && c.authorMemberId === authorMemberId;
    });
    const batch = this.db.batch();
    matching.forEach((doc) => batch.update(doc.ref, toPatch({ status: 'resolved', resolvedAt: at })));
    await batch.commit();
    return matching.length;
  }

  async deleteInvolving(groupId: string, memberId: string): Promise<void> {
    const [against, by] = await Promise.all([
      this.collection(groupId).where('authorMemberId', '==', memberId).get(),
      this.collection(groupId).where('complainerMemberId', '==', memberId).get(),
    ]);
    const batch = this.db.batch();
    [...against.docs, ...by.docs].forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export function createFirestoreRepositories(db: Firestore): {
  cells: CellRepository;
  organizers: OrganizerRepository;
  sessions: SessionRepository;
  groups: GroupRepository;
  members: MemberRepository;
  submissions: SubmissionRepository;
  complaints: ComplaintRepository;
} {
  return {
    submissions: new FirestoreSubmissions(db),
    complaints: new FirestoreComplaints(db),
    cells: new FirestoreCells(db),
    organizers: new FirestoreOrganizers(db),
    sessions: new FirestoreSessions(db),
    groups: new FirestoreGroups(db),
    members: new FirestoreMembers(db),
  };
}
