import { Controller, Get, Param } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { IdPipe } from '../common/id.pipe';
import { StandingsService, StandingsView } from './standings.service';

@Controller()
export class StandingsController {
  constructor(private readonly standings: StandingsService) {}

  @Get('groups/:id/standings')
  view(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<StandingsView> {
    return this.standings.standings(auth.subject, id);
  }
}
