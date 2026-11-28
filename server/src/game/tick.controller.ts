import { Controller, Inject, Logger, Optional, Post, UseGuards } from '@nestjs/common';
import { CLOCK } from '../auth/session.service';
import { Public } from '../common/public.decorator';
import { GROUPS, GroupRepository } from '../data/repositories';
import { REMINDER_RUNNER, ReminderRunner } from '../notifications/notification-sink';
import { GameEngine } from './game-engine';
import { TickGuard } from './tick.guard';

/** Called every minute by Cloud Scheduler so days open on time even when nobody has the app open. */
@Controller('internal')
export class TickController {
  private readonly logger = new Logger(TickController.name);

  constructor(
    private readonly engine: GameEngine,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(CLOCK) private readonly now: () => Date,
    @Optional() @Inject(REMINDER_RUNNER) private readonly reminders?: ReminderRunner,
  ) {}

  // Public for the session and App Check guards: the tick authenticates with its own OIDC guard.
  @Public()
  @UseGuards(TickGuard)
  @Post('tick')
  async tick(): Promise<{ advanced: number; failed: number }> {
    const now = this.now();
    const groups = await this.groups.listWithGame(['draft', 'active']);
    let failed = 0;
    for (const group of groups) {
      // One broken group must not stop the others from opening their days on time.
      try {
        await this.engine.advance(group.id, now);
      } catch (error) {
        failed++;
        this.logger.error(`advance failed for group ${group.id}`, error instanceof Error ? error.stack : String(error));
      }
    }
    // Reminders are a nicety: a failure must not turn the tick into an error.
    await this.reminders?.run(now).catch((error: unknown) => {
      this.logger.warn(`reminders failed: ${error instanceof Error ? error.name : 'unknown'}`);
    });
    return { advanced: groups.length - failed, failed };
  }
}
