import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { aCell, aGroup, aSubmission } from '../data/repositories.contract';
import { GroupsService } from '../groups/groups.service';
import { PhotoEvents } from '../photos/photo-events';
import { PhotosService } from '../photos/photos.service';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let service: LikesService;
  let image: 'full' | 'blur';
  let viewerMemberId: string | undefined;
  let events: { event: string; payload: Record<string, unknown> }[];
  const groupId = 'g1';
  const subject = { kind: 'member' as const, id: 'liker', groupId };

  beforeEach(async () => {
    repos = createMemoryRepositories();
    image = 'full';
    viewerMemberId = 'liker';
    events = [];
    const group = aGroup({ id: groupId });
    await repos.groups.create(group);
    await repos.cells.replaceAll(groupId, [aCell(groupId, 0, { state: 'open' })]);
    await repos.submissions.put(aSubmission(groupId, 0, 'author'), null);
    const now = () => new Date('2026-12-02T10:00:00Z');
    const groups = new GroupsService(repos.groups, repos.members, repos.organizers, now, 'https://app.test');
    jest.spyOn(groups, 'getFor').mockResolvedValue(group);
    const photos = {
      viewerOf: async () => ({ relation: 'member' as const, memberId: viewerMemberId }),
      accessFor: async () => ({ viewer: {}, access: { listed: true, image } }),
    };
    const sink: PhotoEvents = {
      toGroup: (_group, event, payload) => events.push({ event, payload }),
      toOwner: () => undefined,
    };
    service = new LikesService(
      groups,
      photos as unknown as PhotosService,
      repos.cells,
      repos.submissions,
      repos.likes,
      sink,
    );
  });

  it('should add a like under a photo the viewer sees in full and announce it without names', async () => {
    await service.set(subject, groupId, 0, 'author', true);

    expect(await repos.likes.listByGroup(groupId)).toHaveLength(1);
    expect(events).toEqual([{ event: 'like.changed', payload: { dayIndex: 0, memberId: 'author' } }]);
  });

  it('should stay quiet when the like is already there or was never there', async () => {
    await service.set(subject, groupId, 0, 'author', true);
    await service.set(subject, groupId, 0, 'author', true);
    await service.set(subject, groupId, 0, 'author', false);
    await service.set(subject, groupId, 0, 'author', false);

    expect(await repos.likes.listByGroup(groupId)).toEqual([]);
    expect(events.map((e) => e.event)).toEqual(['like.changed', 'like.changed']);
  });

  it('should not let anyone like their own photo', async () => {
    viewerMemberId = 'author';
    await expect(service.set({ ...subject, id: 'author' }, groupId, 0, 'author', true)).rejects.toThrow(
      new ForbiddenException('own_photo'),
    );
  });

  it('should refuse a photo the viewer only sees blurred', async () => {
    image = 'blur';
    await expect(service.set(subject, groupId, 0, 'author', true)).rejects.toThrow(
      new ForbiddenException('not_visible'),
    );
    expect(await repos.likes.listByGroup(groupId)).toEqual([]);
  });

  it('should refuse a hidden photo', async () => {
    await repos.submissions.setStatus(groupId, 0, 'author', 'hidden', new Date());
    await expect(service.set(subject, groupId, 0, 'author', true)).rejects.toThrow(
      new ForbiddenException('not_visible'),
    );
  });

  it('should refuse someone who does not play', async () => {
    viewerMemberId = undefined;
    await expect(service.set(subject, groupId, 0, 'author', true)).rejects.toThrow(
      new ForbiddenException('not_playing'),
    );
  });

  it('should say not found for a photo that does not exist', async () => {
    await expect(service.set(subject, groupId, 0, 'nobody', true)).rejects.toThrow(NotFoundException);
  });
});
