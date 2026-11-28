import { BadRequestException } from '@nestjs/common';
import { PhotosService } from '../photos/photos.service';
import { FeedEntry, SubmissionView } from '../photos/views';
import { FeedService } from './feed.service';

const subject = { kind: 'member' as const, id: 'viewer', groupId: 'g1' };

function entry(at: string, dayIndex: number, memberId: string, extra: Partial<SubmissionView> = {}): FeedEntry {
  return {
    dayIndex,
    taskTitle: { uk: `День ${dayIndex}` },
    revealAt: `2026-12-0${dayIndex + 3}T07:00:00.000Z`,
    view: {
      memberId,
      displayName: memberId,
      submittedAt: at,
      access: 'full',
      likes: { count: 0, mine: false },
      photoUrl: `/p/${memberId}-${dayIndex}`,
      blurUrl: `/p/${memberId}-${dayIndex}-blur`,
      width: 10,
      height: 10,
      mine: false,
      ...extra,
    },
  };
}

describe('FeedService', () => {
  let entries: FeedEntry[];
  let service: FeedService;

  beforeEach(() => {
    entries = [
      entry('2026-12-01T08:00:00Z', 0, 'a'),
      entry('2026-12-01T09:00:00Z', 0, 'b'),
      entry('2026-12-02T08:00:00Z', 1, 'a'),
      entry('2026-12-02T08:00:00Z', 1, 'c'),
      entry('2026-12-03T08:00:00Z', 2, 'b', { mine: true }),
    ];
    const photos = { feed: async () => entries };
    service = new FeedService(photos as unknown as PhotosService);
  });

  const ids = (page: { items: { memberId: string; dayIndex: number }[] }) =>
    page.items.map((item) => `${item.dayIndex}${item.memberId}`);

  it('should list newest first with the day and its task title', async () => {
    const page = await service.page(subject, 'g1', { limit: 20 });
    expect(ids(page)).toEqual(['2b', '1c', '1a', '0b', '0a']);
    expect(page.items[0]).toMatchObject({
      dayIndex: 2,
      taskTitle: { uk: 'День 2' },
      revealAt: '2026-12-05T07:00:00.000Z',
    });
    expect(page.next).toBeUndefined();
  });

  it('should page without duplicates or gaps', async () => {
    const first = await service.page(subject, 'g1', { limit: 2 });
    const second = await service.page(subject, 'g1', { limit: 2, before: first.next });
    const third = await service.page(subject, 'g1', { limit: 2, before: second.next });
    expect([...ids(first), ...ids(second), ...ids(third)]).toEqual(['2b', '1c', '1a', '0b', '0a']);
    expect(first.next).toBeDefined();
    expect(third.next).toBeUndefined();
  });

  it('should keep the next page stable when a newer photo arrives meanwhile', async () => {
    const first = await service.page(subject, 'g1', { limit: 2 });
    entries.push(entry('2026-12-04T08:00:00Z', 3, 'd'));
    const second = await service.page(subject, 'g1', { limit: 2, before: first.next });
    expect(ids(second)).toEqual(['1a', '0b']);
  });

  it('should filter by day, member and own', async () => {
    expect(ids(await service.page(subject, 'g1', { day: 1 }))).toEqual(['1c', '1a']);
    expect(ids(await service.page(subject, 'g1', { memberId: 'a' }))).toEqual(['1a', '0a']);
    expect(ids(await service.page(subject, 'g1', { mine: true }))).toEqual(['2b']);
  });

  it('should refuse bad parameters', async () => {
    await expect(service.page(subject, 'g1', { before: 'nonsense' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.page(subject, 'g1', { limit: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.page(subject, 'g1', { limit: 51 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.page(subject, 'g1', { day: -1 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
