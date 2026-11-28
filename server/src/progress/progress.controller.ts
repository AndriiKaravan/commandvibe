import { Controller, Get, Param } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { IdPipe } from '../common/id.pipe';
import { ProgressService } from './progress.service';
import { ProgressView } from './views';

@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('groups/:id/progress')
  view(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<ProgressView> {
    return this.progress.progressFor(auth.subject, id);
  }
}
