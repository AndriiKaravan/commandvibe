import { Controller, Get, Param } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { IdPipe } from '../common/id.pipe';
import { PointsService } from './points.service';
import { PointsJournalView } from './views';

@Controller()
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get('groups/:id/points')
  journal(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<PointsJournalView> {
    return this.points.journalFor(auth.subject, id);
  }
}
