import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { DayPipe } from '../common/day.pipe';
import { IdPipe } from '../common/id.pipe';
import { organizerUid } from '../groups/groups.controller';
import { ComplaintView, ModerationService } from './moderation.service';

@Controller('groups/:id')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('days/:day/submissions/:memberId/complaints')
  @HttpCode(204)
  async complain(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
    @Body() body: { reason?: unknown },
  ): Promise<void> {
    await this.moderation.complain(auth.subject, id, day, memberId, body?.reason);
  }

  @Get('complaints')
  list(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<{ items: ComplaintView[] }> {
    return this.moderation.list(organizerUid(auth), id);
  }

  @Put('days/:day/submissions/:memberId/hidden')
  @HttpCode(204)
  async setHidden(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
    @Body() body: { hidden?: unknown },
  ): Promise<void> {
    if (typeof body?.hidden !== 'boolean') {
      throw new BadRequestException('invalid_hidden');
    }
    await this.moderation.setHidden(organizerUid(auth), id, day, memberId, body.hidden);
  }

  @Post('days/:day/submissions/:memberId/complaints/dismiss')
  @HttpCode(204)
  async dismiss(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
  ): Promise<void> {
    await this.moderation.dismiss(organizerUid(auth), id, day, memberId);
  }
}
