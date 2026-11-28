import { BadRequestException, Injectable } from '@nestjs/common';
import { SessionSubject } from '../data/models';
import { PhotosService } from '../photos/photos.service';
import { FeedEntry, SubmissionView } from '../photos/views';
import { FeedPosition, decodeCursor, encodeCursor } from './feed-cursor';

export interface FeedQuery {
  day?: number;
  memberId?: string;
  mine?: boolean;
  limit?: number;
  before?: string;
}

export interface FeedItem extends SubmissionView {
  dayIndex: number;
  taskTitle: { uk: string; en?: string };
  revealAt: string;
}

export interface FeedPage {
  items: FeedItem[];
  /** Pass as `before` for the next page; absent on the last page. */
  next?: string;
}

const defaultLimit = 20;
const maxLimit = 50;

/** Newest first; ties broken by day and member so the order never wobbles. */
function newerFirst(a: FeedEntry, b: FeedEntry): number {
  return (
    Date.parse(b.view.submittedAt) - Date.parse(a.view.submittedAt) ||
    b.dayIndex - a.dayIndex ||
    (a.view.memberId < b.view.memberId ? 1 : a.view.memberId > b.view.memberId ? -1 : 0)
  );
}

function isBefore(entry: FeedEntry, position: FeedPosition): boolean {
  return (
    newerFirst(entry, {
      dayIndex: position.dayIndex,
      taskTitle: entry.taskTitle,
      revealAt: entry.revealAt,
      view: { ...entry.view, submittedAt: position.submittedAt.toISOString(), memberId: position.memberId },
    }) > 0
  );
}

@Injectable()
export class FeedService {
  constructor(private readonly photos: PhotosService) {}

  async page(subject: SessionSubject, groupId: string, query: FeedQuery): Promise<FeedPage> {
    const limit = query.limit ?? defaultLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
      throw new BadRequestException('invalid_limit');
    }
    if (query.day !== undefined && (!Number.isInteger(query.day) || query.day < 0)) {
      throw new BadRequestException('invalid_day');
    }
    const position = query.before === undefined ? undefined : decodeCursor(query.before);
    if (query.before !== undefined && !position) {
      throw new BadRequestException('invalid_cursor');
    }
    const all = (await this.photos.feed(subject, groupId))
      .filter((entry) => query.day === undefined || entry.dayIndex === query.day)
      .filter((entry) => !query.memberId || entry.view.memberId === query.memberId)
      .filter((entry) => !query.mine || entry.view.mine)
      .sort(newerFirst)
      .filter((entry) => !position || isBefore(entry, position));
    const slice = all.slice(0, limit);
    const last = slice[slice.length - 1];
    return {
      items: slice.map((entry) => ({
        ...entry.view,
        dayIndex: entry.dayIndex,
        taskTitle: entry.taskTitle,
        revealAt: entry.revealAt,
      })),
      ...(all.length > limit && last
        ? {
            next: encodeCursor({
              submittedAt: new Date(last.view.submittedAt),
              dayIndex: last.dayIndex,
              memberId: last.view.memberId,
            }),
          }
        : {}),
    };
  }
}
