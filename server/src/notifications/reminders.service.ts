import { Inject, Injectable } from '@nestjs/common';
import {
  CELLS,
  CellRepository,
  GROUPS,
  GroupRepository,
  MEMBERS,
  MemberRepository,
  SUBMISSIONS,
  SubmissionRepository,
} from '../data/repositories';
import { ReminderRunner } from './notification-sink';
import { NotificationSources } from './notification-sources';
import { inQuietHours, localDayStart } from './quiet-hours';

const reminderFromHour = 19;
const hourMs = 60 * 60 * 1000;

/** The evening nudge: only to people who have not done today's task, once a day, before quiet hours. */
@Injectable()
export class RemindersService implements ReminderRunner {
  constructor(
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(SUBMISSIONS) private readonly submissions: SubmissionRepository,
    private readonly sources: NotificationSources,
  ) {}

  /** Number of reminders made in this run. */
  async run(now: Date): Promise<number> {
    let made = 0;
    for (const group of await this.groups.listWithGame(['active'])) {
      if (this.isEvening(now, group.timezone)) {
        made += await this.remind(group.id, now);
      }
    }
    return made;
  }

  private isEvening(now: Date, timeZone: string): boolean {
    const sinceMidnight = now.getTime() - localDayStart(now, timeZone).getTime();
    return sinceMidnight >= reminderFromHour * hourMs && !inQuietHours(now, timeZone);
  }

  private async remind(groupId: string, now: Date): Promise<number> {
    const due = (await this.cells.list(groupId)).filter((cell) => cell.opensAt.getTime() <= now.getTime());
    const today = due[due.length - 1];
    if (today?.state !== 'open') {
      return 0;
    }
    const [players, done] = await Promise.all([
      this.members.list(groupId),
      this.submissions.listDay(groupId, today.dayIndex),
    ]);
    const finished = new Set(done.map((submission) => submission.memberId));
    let made = 0;
    for (const player of players.filter((m) => m.status === 'active' && !finished.has(m.id))) {
      if (await this.sources.reminder(groupId, today.dayIndex, player.id)) {
        made++;
      }
    }
    return made;
  }
}
