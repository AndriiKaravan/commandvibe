import { Body, Controller, Inject, Module, Post } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Public } from '../common/public.decorator';
import { ORGANIZERS, OrganizerRepository } from '../data/repositories';
import { GroupsModule } from '../groups/groups.module';
import { GroupsService } from '../groups/groups.service';

/** Seeds a group for app integration tests; mounted only when NODE_ENV=test. */
@Controller('test')
class TestSeedController {
  constructor(
    private readonly groups: GroupsService,
    @Inject(ORGANIZERS) private readonly organizers: OrganizerRepository,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  @Public()
  @Post('seed-group')
  async seed(@Body() body: { name?: string; approveNew?: boolean }): Promise<{ groupId: string; token: string }> {
    const uid = `seed-${Date.now().toString(36)}`;
    await this.organizers.upsert({ uid, email: `${uid}@example.test`, displayName: 'Seed', createdAt: this.now() });
    const { group, inviteUrl } = await this.groups.create(uid, {
      name: body?.name ?? 'Test group',
      timezone: 'Europe/Kyiv',
      playsToo: false,
      approveNew: body?.approveNew === true,
    });
    return { groupId: group.id, token: inviteUrl.split('/j/')[1] };
  }
}

@Module({ imports: [GroupsModule], controllers: [TestSeedController] })
export class TestSeedModule {}
