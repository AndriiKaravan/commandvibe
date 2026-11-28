import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { hashToken } from '../common/tokens';
import { GroupsService } from './groups.service';

describe('GroupsService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let service: GroupsService;
  const organizer = { uid: 'org-1', email: 'olena@example.com', displayName: 'Olena', createdAt: new Date() };

  beforeEach(async () => {
    repos = createMemoryRepositories();
    await repos.organizers.upsert(organizer);
    service = new GroupsService(repos.groups, repos.members, repos.organizers, () => new Date(), 'https://app.test');
  });

  it('should create a group with the organizer as a playing member by default', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    const members = await repos.members.list(group.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      isOrganizer: true,
      organizerUid: 'org-1',
      status: 'active',
      displayName: 'Olena',
    });
    expect(group.settings).toMatchObject({ approveNew: false });
  });

  it('should not add the organizer when playsToo is false', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv', playsToo: false });
    expect(await repos.members.list(group.id)).toHaveLength(0);
  });

  it('should keep only the hash of the invite token', async () => {
    const { group, inviteUrl } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    const token = inviteUrl.split('/j/')[1];
    const stored = await repos.groups.get(group.id);
    expect(inviteUrl).toMatch(/^https:\/\/app\.test\/j\/[A-Za-z0-9_-]{22}$/);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored?.inviteTokenHash).toBe(hashToken(token));
  });

  it('should invalidate the old invite after rotate', async () => {
    const { group, inviteUrl } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    const oldToken = inviteUrl.split('/j/')[1];
    const rotated = await service.rotateInvite('org-1', group.id);
    expect(await repos.groups.findByInviteHash(hashToken(oldToken))).toBeUndefined();
    expect((await repos.groups.findByInviteHash(hashToken(rotated.inviteUrl.split('/j/')[1])))?.id).toBe(group.id);
  });

  it('should reopen a closed invite only by rotating it', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    await service.closeInvite('org-1', group.id);
    expect((await repos.groups.get(group.id))?.inviteClosed).toBe(true);
    await service.rotateInvite('org-1', group.id);
    expect((await repos.groups.get(group.id))?.inviteClosed).toBe(false);
  });

  it('should list only the groups of the organizer, newest first, with active member counts', async () => {
    const first = await service.create('org-1', { name: 'First', timezone: 'Europe/Kyiv' });
    await service.create('org-2', { name: 'Foreign', timezone: 'Europe/Kyiv', playsToo: false });
    const clock = new Date(Date.now() + 1000);
    const later = new GroupsService(repos.groups, repos.members, repos.organizers, () => clock, 'https://app.test');
    const second = await later.create('org-1', { name: 'Second', timezone: 'Europe/Kyiv', playsToo: false });
    const list = await service.listOwned('org-1');
    expect(list.map((item) => item.id)).toEqual([second.group.id, first.group.id]);
    expect(list.map((item) => item.activeMembers)).toEqual([0, 1]);
    expect(list[0]).toMatchObject({ name: 'Second', status: 'draft' });
    expect(JSON.stringify(list)).not.toContain('inviteTokenHash');
  });

  it('should let the owner switch likes-count-only on and off', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    await service.updateSettings('org-1', group.id, { likesCountOnly: true });
    expect((await repos.groups.get(group.id))?.settings.likesCountOnly).toBe(true);
    await service.updateSettings('org-1', group.id, { likesCountOnly: false });
    expect((await repos.groups.get(group.id))?.settings.likesCountOnly).toBe(false);
  });

  it('should keep the other settings when one changes', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv', approveNew: true });
    await service.updateSettings('org-1', group.id, { likesCountOnly: true });
    expect((await repos.groups.get(group.id))?.settings).toMatchObject({ approveNew: true, likesCountOnly: true });
  });

  it.each([
    { likesCountOnly: 'yes' },
    { likesCountOnly: 1 },
    { likesCountOnly: null },
    {},
    { approveNew: true },
    { likesCountOnly: true, memberLimit: 1 },
    null,
    'text',
  ])('should refuse the settings %p', async (patch) => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    await expect(service.updateSettings('org-1', group.id, patch)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should refuse settings changes from a non-owner', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    await expect(service.updateSettings('org-2', group.id, { likesCountOnly: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('should forbid group settings to a non-owner', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    await expect(service.rotateInvite('org-2', group.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.closeInvite('org-2', group.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should reject an unknown time zone and an empty name', async () => {
    await expect(service.create('org-1', { name: 'Office', timezone: 'Mars/Base' })).rejects.toThrow(
      'invalid_timezone',
    );
    await expect(service.create('org-1', { name: '   ', timezone: 'Europe/Kyiv' })).rejects.toThrow('invalid_name');
  });

  it('should let an active member and the owner read the group, but not others', async () => {
    const { group } = await service.create('org-1', { name: 'Office', timezone: 'Europe/Kyiv' });
    const [member] = await repos.members.list(group.id);
    await expect(service.getFor({ kind: 'organizer', id: 'org-1' }, group.id)).resolves.toMatchObject({ id: group.id });
    await expect(service.getFor({ kind: 'member', id: member.id, groupId: group.id }, group.id)).resolves.toBeDefined();
    await expect(service.getFor({ kind: 'organizer', id: 'org-2' }, group.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getFor({ kind: 'member', id: 'x', groupId: group.id }, group.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
