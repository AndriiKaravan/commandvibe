import { Controller, Delete, HttpCode, Param, Put } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { DayPipe } from '../common/day.pipe';
import { IdPipe } from '../common/id.pipe';
import { LikesService } from './likes.service';

@Controller('groups/:id/days/:day/submissions/:memberId/like')
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  @Put()
  @HttpCode(204)
  async give(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
  ): Promise<void> {
    await this.likes.set(auth.subject, id, day, memberId, true);
  }

  @Delete()
  @HttpCode(204)
  async takeBack(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
  ): Promise<void> {
    await this.likes.set(auth.subject, id, day, memberId, false);
  }
}
