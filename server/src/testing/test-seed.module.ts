import { Body, Controller, Inject, Module, Post } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Public } from '../common/public.decorator';
import { ORGANIZERS, OrganizerRepository } from '../data/repositories';
import { CalendarService } from '../game/calendar.service';
import { GameModule } from '../game/game.module';
import { GroupsModule } from '../groups/groups.module';
import { GroupsService } from '../groups/groups.service';

/** Seeds a group for app integration tests; mounted only when NODE_ENV=test. */
@Controller('test')
class TestSeedController {
  constructor(
    private readonly groups: GroupsService,
    private readonly calendar: CalendarService,
    @Inject(ORGANIZERS) private readonly organizers: OrganizerRepository,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  @Public()
  @Post('seed-group')
  async seed(
    @Body() body: { name?: string; approveNew?: boolean; game?: { mode?: 'auto' | 'roulette' } },
  ): Promise<{ groupId: string; token: string }> {
    const uid = `seed-${Date.now().toString(36)}`;
    await this.organizers.upsert({ uid, email: `${uid}@example.test`, displayName: 'Seed', createdAt: this.now() });
    const { group, inviteUrl } = await this.groups.create(uid, {
      name: body?.name ?? 'Test group',
      timezone: 'Europe/Kyiv',
      playsToo: false,
      approveNew: body?.approveNew === true,
    });
    if (body?.game) {
      // Day 0 opens at local midnight today, so a test sees the game running at once.
      await this.calendar.configure(uid, group.id, {
        startDate: new Intl.DateTimeFormat('en-CA', { timeZone: group.timezone }).format(this.now()),
        days: 7,
        openTime: '00:00',
        mode: body.game.mode ?? 'auto',
        categories: ['home'],
      });
    }
    return { groupId: group.id, token: inviteUrl.split('/j/')[1] };
  }
}

@Module({ imports: [GroupsModule, GameModule], controllers: [TestSeedController] })
export class TestSeedModule {}
