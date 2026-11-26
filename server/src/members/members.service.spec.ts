import { ConflictException, GoneException, HttpException, UnprocessableEntityException } from '@nestjs/common';
import { SessionService } from '../auth/session.service';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { GroupsService } from '../groups/groups.service';
import { MemberEvents, MembersService } from './members.service';
import { PinService } from './pin.service';

class RecordingEvents implements MemberEvents {
  readonly calls: string[] = [];
  joined(groupId: string, memberId: string, pending: boolean): void {
    this.calls.push(`${pending ? 'pending' : 'joined'}:${groupId}:${memberId}`);
  }
  removed(groupId: string, memberId: string): void {
    this.calls.push(`removed:${groupId}:${memberId}`);
  }
  approved(groupId: string, memberId: string): void {
    this.calls.push(`approved:${groupId}:${memberId}`);
  }
}

describe('MembersService', () => {
  let now: number;
  let repos: ReturnType<typeof createMemoryRepositories>;
  let sessions: SessionService;
  let groups: GroupsService;
  let events: RecordingEvents;
  let service: MembersService;
  const clock = () => new Date(now);

  beforeEach(async () => {
    now = Date.UTC(2026, 11, 1, 9);
    repos = createMemoryRepositories();
    await repos.organizers.upsert({ uid: 'org', email: 'o@example.com', displayName: 'Org', createdAt: clock() });
    sessions = new SessionService(repos.sessions, 'k'.repeat(32), clock);
    groups = new GroupsService(repos.groups, repos.members, repos.organizers, clock, 'https://app.test');
    events = new RecordingEvents();
    service = new MembersService(repos.groups, repos.members, groups, sessions, new PinService(), events, clock);
  });

  async function newGroup(approveNew = false) {
    const created = await groups.create('org', { name: 'Office', timezone: 'Europe/Kyiv', playsToo: false, approveNew });
    return { group: created.group, token: created.inviteUrl.split('/j/')[1] };
  }

  it('should join as active when approveNew is off', async () => {
    const { group, token } = await newGroup();
    const result = await service.join(token, 'Olena', undefined, 'ua');
    expect(result.member).toMatchObject({ status: 'active', displayName: 'Olena', groupId: group.id });
    await expect(sessions.verifyAccess(result.accessToken)).resolves.toMatchObject({
      subject: { kind: 'member', id: result.member.id, groupId: group.id },
    });
    expect(events.calls).toEqual([`joined:${group.id}:${result.member.id}`]);
  });

  it('should join as pending when approveNew is on', async () => {
    const { token } = await newGroup(true);
    const result = await service.join(token, 'Olena', undefined, 'ua');
    expect(result.member.status).toBe('pending');
    expect(events.calls[0]).toMatch(/^pending:/);
  });

  it('should reject a taken name with 409', async () => {
    const { token } = await newGroup();
    await service.join(token, 'Olena', undefined, 'ua');
    await expect(service.join(token, ' olena ', undefined, 'ua')).rejects.toBeInstanceOf(ConflictException);
  });

  it('should refuse a full group with 422', async () => {
    const { group, token } = await newGroup();
    await repos.groups.update(group.id, { settings: { ...group.settings, memberLimit: 1 } });
    await service.join(token, 'Olena', undefined, 'ua');
    await expect(service.join(token, 'Taras', undefined, 'ua')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('should answer 410 for a rotated or closed invite', async () => {
    const { group, token } = await newGroup();
    await groups.rotateInvite('org', group.id);
    await expect(service.join(token, 'Olena', undefined, 'ua')).rejects.toBeInstanceOf(GoneException);
    const fresh = await groups.rotateInvite('org', group.id);
    await groups.closeInvite('org', group.id);
    await expect(service.preview(fresh.inviteUrl.split('/j/')[1])).rejects.toBeInstanceOf(GoneException);
  });

  it('should accept a department only from the group list', async () => {
    const { group, token } = await newGroup();
    await repos.groups.update(group.id, { settings: { ...group.settings, departments: ['Sales'] } });
    await expect(service.join(token, 'Olena', 'Hackers', 'ua')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.join(token, 'Olena', 'Sales', 'ua')).resolves.toMatchObject({ member: { department: 'Sales' } });
  });

  it('should reject an empty or too long name', async () => {
    const { token } = await newGroup();
    await expect(service.join(token, '   ', undefined, 'ua')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.join(token, 'x'.repeat(41), undefined, 'ua')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  describe('PIN', () => {
    async function memberWithPin() {
      const { token } = await newGroup();
      const joined = await service.join(token, 'Olena', undefined, 'ua');
      await service.setPin(joined.member, '1234');
      return { token, member: joined.member };
    }

    async function statusOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
      try {
        await promise;
        return { status: 200, body: undefined };
      } catch (error) {
        if (error instanceof HttpException) {
          return { status: error.getStatus(), body: error.getResponse() };
        }
        throw error;
      }
    }

    it('should require exactly 4 digits', async () => {
      const { token } = await newGroup();
      const { member } = await service.join(token, 'Olena', undefined, 'ua');
      await expect(service.setPin(member, '12a4')).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.setPin(member, '12345')).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('should sign in from another device with the right PIN', async () => {
      const { token, member } = await memberWithPin();
      const result = await service.returning(token, 'OLENA', '1234', 'laptop');
      expect(result.member.id).toBe(member.id);
    });

    it('should report attempts left after a wrong PIN', async () => {
      const { token } = await memberWithPin();
      const answer = await statusOf(service.returning(token, 'Olena', '0000', 'x'));
      expect(answer.status).toBe(401);
      expect(answer.body).toMatchObject({ code: 'wrong_pin', attemptsLeft: 4 });
    });

    it('should lock after 5 wrong PINs for 15 minutes', async () => {
      const { token } = await memberWithPin();
      for (let i = 0; i < 4; i++) {
        expect((await statusOf(service.returning(token, 'Olena', '0000', 'x'))).status).toBe(401);
      }
      const fifth = await statusOf(service.returning(token, 'Olena', '0000', 'x'));
      expect(fifth.status).toBe(429);
      expect(fifth.body).toMatchObject({ code: 'pin_locked', retryAfterSeconds: 900 });
      expect((await statusOf(service.returning(token, 'Olena', '1234', 'x'))).status).toBe(429);
      now += (15 * 60 + 1) * 1000;
      expect((await statusOf(service.returning(token, 'Olena', '1234', 'x'))).status).toBe(200);
    });

    it('should not reset the failure counter on a new request', async () => {
      const { token, member } = await memberWithPin();
      await statusOf(service.returning(token, 'Olena', '0000', 'x'));
      await statusOf(service.returning(token, 'Olena', '0000', 'y'));
      expect((await repos.members.secrets(member.groupId, member.id)).pinFailures).toBe(2);
    });

    it('should answer the same 401 for an unknown name as for a member without PIN', async () => {
      const { token } = await memberWithPin();
      await service.join(token, 'Taras', undefined, 'ua');
      const unknown = await statusOf(service.returning(token, 'Nobody', '1234', 'x'));
      const noPin = await statusOf(service.returning(token, 'Taras', '1234', 'x'));
      expect(unknown).toEqual({ status: 401, body: expect.objectContaining({ code: 'no_such_login' }) });
      expect(noPin).toEqual(unknown);
    });

    it('should let the organizer reset a locked PIN', async () => {
      const { token, member } = await memberWithPin();
      for (let i = 0; i < 5; i++) {
        await statusOf(service.returning(token, 'Olena', '0000', 'x'));
      }
      await service.resetPin('org', member.groupId, member.id);
      expect(await repos.members.secrets(member.groupId, member.id)).toEqual({ pinFailures: 0 });
    });
  });

  describe('organizer actions', () => {
    it('should revoke sessions when the organizer removes a member', async () => {
      const { group, token } = await newGroup();
      const joined = await service.join(token, 'Olena', undefined, 'ua');
      await service.remove('org', group.id, joined.member.id);
      await expect(sessions.verifyAccess(joined.accessToken)).rejects.toThrow();
      expect((await repos.members.get(group.id, joined.member.id))?.status).toBe('removed');
      expect(events.calls).toContain(`removed:${group.id}:${joined.member.id}`);
    });

    it('should approve a pending member', async () => {
      const { group, token } = await newGroup(true);
      const joined = await service.join(token, 'Olena', undefined, 'ua');
      await service.approve('org', group.id, joined.member.id);
      expect((await repos.members.get(group.id, joined.member.id))?.status).toBe('active');
      expect(events.calls).toContain(`approved:${group.id}:${joined.member.id}`);
    });

    it('should let the organizer rename a member but not onto a taken name', async () => {
      const { group, token } = await newGroup();
      const olena = await service.join(token, 'Olena', undefined, 'ua');
      await service.join(token, 'Taras', undefined, 'ua');
      await expect(service.rename('org', group.id, olena.member.id, 'Taras')).rejects.toBeInstanceOf(ConflictException);
      await service.rename('org', group.id, olena.member.id, 'Lena');
      expect((await repos.members.get(group.id, olena.member.id))?.displayName).toBe('Lena');
    });

    it('should forbid organizer actions to someone else', async () => {
      const { group, token } = await newGroup();
      const joined = await service.join(token, 'Olena', undefined, 'ua');
      await expect(service.remove('org-2', group.id, joined.member.id)).rejects.toThrow();
      expect((await repos.members.get(group.id, joined.member.id))?.status).toBe('active');
    });
  });
});
