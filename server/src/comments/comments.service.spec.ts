import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { aCell, aComment, aGroup, aMember, aSubmission } from '../data/repositories.contract';
import { GroupsService } from '../groups/groups.service';
import { PhotoEvents } from '../photos/photo-events';
import { PhotosService } from '../photos/photos.service';
import { CommentsService, maxCommentLength } from './comments.service';

describe('CommentsService', () => {
  let repos: ReturnType<typeof createMemoryRepositories>;
  let service: CommentsService;
  let image: 'full' | 'blur';
  let relation: 'member' | 'owner';
  let viewerMemberId: string | undefined;
  let events: { event: string; payload: Record<string, unknown> }[];
  const groupId = 'g1';
  const subject = { kind: 'member' as const, id: 'writer', groupId };

  beforeEach(async () => {
    repos = createMemoryRepositories();
    image = 'full';
    relation = 'member';
    viewerMemberId = 'writer';
    events = [];
    const group = aGroup({ id: groupId });
    await repos.groups.create(group);
    await repos.members.createUnique(aMember(groupId, 'Writer', { id: 'writer' }));
    await repos.members.createUnique(aMember(groupId, 'Author', { id: 'author', avatar: 'av02' }));
    await repos.cells.replaceAll(groupId, [aCell(groupId, 0, { state: 'open' })]);
    await repos.submissions.put(aSubmission(groupId, 0, 'author'), null);
    const now = () => new Date('2026-12-02T10:00:00Z');
    const groups = new GroupsService(repos.groups, repos.members, repos.organizers, now, 'https://app.test');
    jest.spyOn(groups, 'getFor').mockResolvedValue(group);
    const photos = {
      viewerOf: async () => ({ relation, memberId: viewerMemberId }),
      accessFor: async () => ({ viewer: {}, access: { listed: true, image } }),
    };
    const sink: PhotoEvents = {
      toGroup: (_g, event, payload) => events.push({ event, payload }),
      toOwner: () => undefined,
    };
    service = new CommentsService(
      groups,
      photos as unknown as PhotosService,
      repos.cells,
      repos.submissions,
      repos.members,
      repos.comments,
      sink,
      now,
    );
  });

  const add = (text: unknown, who = subject) => service.add(who, groupId, 0, 'author', text);

  it('should add a trimmed comment with the writer name and announce it without the text', async () => {
    const item = await add('  Nice shot!  ');

    expect(item).toMatchObject({ text: 'Nice shot!', displayName: 'Writer', mine: true, canDelete: true });
    expect(events).toEqual([{ event: 'comment.created', payload: { dayIndex: 0, memberId: 'author', by: 'writer' } }]);
    expect(JSON.stringify(events)).not.toContain('Nice shot');
  });

  it.each(['', '   ', '\n\t', undefined, null, 5, {}])('should refuse the text %p', async (text) => {
    await expect(add(text)).rejects.toThrow(new BadRequestException('invalid_text'));
  });

  it('should accept exactly the maximum length and refuse one more, counting characters not bytes', async () => {
    await expect(add('я'.repeat(maxCommentLength))).resolves.toBeDefined();
    await expect(add('я'.repeat(maxCommentLength + 1))).rejects.toThrow(new BadRequestException('invalid_text'));
    await expect(add('😀'.repeat(maxCommentLength))).resolves.toBeDefined();
    await expect(add('😀'.repeat(maxCommentLength + 1))).rejects.toThrow(new BadRequestException('invalid_text'));
  });

  it('should list from the oldest with who may delete what', async () => {
    await repos.comments.add(
      aComment(groupId, 0, 'author', 'author', { text: 'older', createdAt: new Date('2026-12-02T08:00:00Z') }),
    );
    await add('mine');
    const items = await service.list(subject, groupId, 0, 'author');

    expect(items.map((i) => i.text)).toEqual(['older', 'mine']);
    expect(items.map((i) => [i.mine, i.canDelete])).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(items[0]).toMatchObject({ displayName: 'Author', avatar: 'av02' });
  });

  it('should show nothing under a photo the viewer only sees blurred, and refuse writing there', async () => {
    image = 'blur';
    await expect(service.list(subject, groupId, 0, 'author')).rejects.toThrow(new ForbiddenException('not_visible'));
    await expect(add('hi')).rejects.toThrow(new ForbiddenException('not_visible'));
  });

  it('should refuse a hidden photo', async () => {
    await repos.submissions.setStatus(groupId, 0, 'author', 'hidden', new Date());
    await expect(add('hi')).rejects.toThrow(new ForbiddenException('not_visible'));
  });

  it('should refuse writing to someone who does not play but let an organizer read', async () => {
    viewerMemberId = undefined;
    relation = 'owner';
    await expect(add('hi')).rejects.toThrow(new ForbiddenException('not_playing'));
    await expect(service.list(subject, groupId, 0, 'author')).resolves.toEqual([]);
  });

  it('should say not found for a photo that does not exist', async () => {
    await expect(service.add(subject, groupId, 0, 'nobody', 'hi')).rejects.toThrow(NotFoundException);
  });

  describe('delete', () => {
    it('should let the writer remove their own comment and announce it', async () => {
      const item = await add('bye');
      events.length = 0;
      await service.delete(subject, groupId, 0, 'author', item.id);

      expect(await repos.comments.get(groupId, item.id)).toBeUndefined();
      expect(events).toEqual([{ event: 'comment.deleted', payload: { dayIndex: 0, memberId: 'author' } }]);
    });

    it('should let the organizer remove any comment, even under a photo seen blurred', async () => {
      const item = await add('rude');
      image = 'blur';
      relation = 'owner';
      viewerMemberId = undefined;
      await service.delete({ kind: 'organizer', id: 'owner-1' }, groupId, 0, 'author', item.id);

      expect(await repos.comments.get(groupId, item.id)).toBeUndefined();
    });

    it('should not let another member remove it', async () => {
      const item = await add('mine');
      viewerMemberId = 'someone';
      await expect(service.delete({ ...subject, id: 'someone' }, groupId, 0, 'author', item.id)).rejects.toThrow(
        new ForbiddenException('not_yours'),
      );
      expect(await repos.comments.get(groupId, item.id)).toBeDefined();
    });

    it('should say not found for a comment of another photo or one that is gone', async () => {
      const item = await add('mine');
      await expect(service.delete(subject, groupId, 0, 'other-author', item.id)).rejects.toThrow(NotFoundException);
      await expect(service.delete(subject, groupId, 0, 'author', 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});
