import { BadRequestException, Body, Controller, Get, Param, PipeTransform, Post, Put, Query } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { IdPipe } from '../common/id.pipe';
import { organizerUid } from '../groups/groups.controller';
import { CalendarService, ConfigureInput, SetTaskInput } from './calendar.service';
import { CalendarView, CatalogTaskView, DayView, isCategory, searchCatalog } from './views';

/** A day number in the URL: 0..30 (a game lasts at most 31 days); the service checks it against the game. */
class DayPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (typeof value !== 'string' || !/^\d{1,2}$/.test(value) || Number(value) > 30) {
      throw new BadRequestException('invalid_day');
    }
    return Number(value);
  }
}

@Controller()
export class GameController {
  constructor(private readonly calendar: CalendarService) {}

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
}
