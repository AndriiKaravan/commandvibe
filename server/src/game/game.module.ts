import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { CalendarService } from './calendar.service';
import { GameController } from './game.controller';
import { GameEngine } from './game-engine';
import { RealtimeGameEvents } from './game-events';
import { GAME_EVENTS, RANDOM } from './game.tokens';

@Module({
  imports: [GroupsModule],
  controllers: [GameController],
  providers: [
    CalendarService,
    GameEngine,
    RealtimeGameEvents,
    { provide: GAME_EVENTS, useExisting: RealtimeGameEvents },
    { provide: RANDOM, useValue: Math.random },
  ],
  exports: [CalendarService, GameEngine],
})
export class GameModule {}
