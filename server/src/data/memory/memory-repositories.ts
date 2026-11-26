import { Group, Member, MemberSecrets, Organizer, Session } from '../models';
import {
  GroupRepository,
  MemberRepository,
  NameTakenError,
  OrganizerRepository,
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

export function createMemoryRepositories(): {
  organizers: OrganizerRepository;
  sessions: SessionRepository;
  groups: GroupRepository;
  members: MemberRepository;
} {
  return {
    organizers: new MemoryOrganizers(),
    sessions: new MemorySessions(),
    groups: new MemoryGroups(),
    members: new MemoryMembers(),
  };
}
