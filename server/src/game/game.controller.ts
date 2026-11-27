import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { CLOCK, VerifiedAccess } from '../auth/session.service';
import { DayPipe } from '../common/day.pipe';
import { IdPipe } from '../common/id.pipe';
import { organizerUid } from '../groups/groups.controller';
import { CalendarService, ConfigureInput, SetTaskInput } from './calendar.service';
import { GameEngine } from './game-engine';
import { CalendarView, CatalogTaskView, DayView, TodayView, isCategory, searchCatalog } from './views';

@Controller()
export class GameController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly engine: GameEngine,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  @Get('catalog')
  catalog(
    @CurrentAuth() auth: VerifiedAccess,
    @Query('category') category?: string,
    @Query('q') query?: string,
  ): { tasks: CatalogTaskView[] } {
    organizerUid(auth);
    if (category !== undefined && !isCategory(category)) {
      throw new BadRequestException('invalid_category');
    }
    return { tasks: searchCatalog(category, typeof query === 'string' ? query : undefined) };
  }

  @Put('groups/:id/game')
  configure(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Body() body: ConfigureInput,
  ): Promise<CalendarView> {
    return this.calendar.configure(organizerUid(auth), id, body);
  }

  @Get('groups/:id/calendar')
  view(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<CalendarView> {
    return this.calendar.calendar(auth.subject, id);
  }

  @Post('groups/:id/calendar/days/:day/other')
  other(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
  ): Promise<DayView> {
    return this.calendar.other(organizerUid(auth), id, day);
  }

  @Put('groups/:id/calendar/days/:day/task')
  setTask(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Body() body: SetTaskInput,
  ): Promise<DayView> {
    return this.calendar.setTask(organizerUid(auth), id, day, body);
  }

  @Post('groups/:id/calendar/days/:day/move')
  move(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Body() body: { to?: number },
  ): Promise<CalendarView> {
    return this.calendar.move(organizerUid(auth), id, day, body?.to as number);
  }

  @Get('groups/:id/today')
  today(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<TodayView> {
    return this.engine.today(auth.subject, id, this.now());
  }

  @Post('groups/:id/roulette/spin')
  @HttpCode(204)
  async spin(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<void> {
    await this.engine.spin(auth.subject, id, this.now());
  }
}
