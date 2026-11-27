import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { CalendarService } from './calendar.service';
import { GameController } from './game.controller';
import { RANDOM } from './game.tokens';

@Module({
  imports: [GroupsModule],
  controllers: [GameController],
  providers: [CalendarService, { provide: RANDOM, useValue: Math.random }],
  exports: [CalendarService],
})
export class GameModule {}
