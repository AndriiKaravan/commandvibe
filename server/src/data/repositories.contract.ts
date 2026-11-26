import { Group, Member, Session, defaultGroupSettings, nameKeyOf } from './models';
import { GroupRepository, MemberRepository, NameTakenError, SessionRepository } from './repositories';

export interface RepositorySet {
  groups: GroupRepository;
  members: MemberRepository;
  sessions: SessionRepository;
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
    });

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
      await repos.members.updateSecrets(group.id, member.id, { pinHash: undefined, pinFailures: 0, lockedUntil: undefined });
      const secrets = await repos.members.secrets(group.id, member.id);
      expect(secrets.pinHash).toBeUndefined();
      expect(secrets.lockedUntil).toBeUndefined();
      expect(secrets.pinFailures).toBe(0);
    });
  });
}
