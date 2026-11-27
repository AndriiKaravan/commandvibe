import { Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Public } from '../common/public.decorator';
import { GROUPS, GroupRepository } from '../data/repositories';
import { GameEngine } from './game-engine';
import { TickGuard } from './tick.guard';

/** Called every minute by Cloud Scheduler so days open on time even when nobody has the app open. */
@Controller('internal')
export class TickController {
  constructor(
    private readonly engine: GameEngine,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  // Public for the session and App Check guards: the tick authenticates with its own OIDC guard.
  @Public()
  @UseGuards(TickGuard)
  @Post('tick')
  async tick(): Promise<{ advanced: number }> {
    const now = this.now();
    const groups = await this.groups.listWithGame(['draft', 'active']);
    for (const group of groups) {
      await this.engine.advance(group.id, now);
    }
    return { advanced: groups.length };
  }
}
