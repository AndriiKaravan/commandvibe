import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { Group, Member, MemberSecrets, Organizer, Session } from '../models';
import {
  GroupRepository,
  MemberRepository,
  NameTakenError,
  OrganizerRepository,
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

// Document ids cannot contain '/', and name keys are free text.
const nameDocId = (nameKey: string): string => encodeURIComponent(nameKey);

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

  async secrets(groupId: string, id: string): Promise<MemberSecrets> {
    const data = fromStore<MemberSecrets>((await this.secretsRef(groupId, id).get()).data());
    return { pinFailures: 0, ...data };
  }

  async updateSecrets(groupId: string, id: string, patch: Partial<MemberSecrets>): Promise<void> {
    await this.secretsRef(groupId, id).set(toPatch(patch), { merge: true });
  }
}

export function createFirestoreRepositories(db: Firestore): {
  organizers: OrganizerRepository;
  sessions: SessionRepository;
  groups: GroupRepository;
  members: MemberRepository;
} {
  return {
    organizers: new FirestoreOrganizers(db),
    sessions: new FirestoreSessions(db),
    groups: new FirestoreGroups(db),
    members: new FirestoreMembers(db),
  };
}
