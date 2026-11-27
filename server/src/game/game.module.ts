import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { CalendarService } from './calendar.service';
import { GameController } from './game.controller';
import { GameEngine } from './game-engine';
import { RealtimeGameEvents } from './game-events';
import { TickController } from './tick.controller';
import { GoogleOidcVerifier, OIDC_VERIFIER, TICK_CONFIG, TickGuard } from './tick.guard';
import { GAME_EVENTS, RANDOM } from './game.tokens';

@Module({
  imports: [GroupsModule],
  controllers: [GameController, TickController],
  providers: [
    CalendarService,
    GameEngine,
    RealtimeGameEvents,
    { provide: GAME_EVENTS, useExisting: RealtimeGameEvents },
    { provide: RANDOM, useValue: Math.random },
    TickGuard,
    { provide: OIDC_VERIFIER, useClass: GoogleOidcVerifier },
    {
      provide: TICK_CONFIG,
      useFactory: () => ({ audience: process.env.TICK_AUDIENCE, invoker: process.env.TICK_INVOKER }),
    },
  ],
  exports: [CalendarService, GameEngine],
})
export class GameModule {}
