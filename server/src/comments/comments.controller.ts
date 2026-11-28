import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { DayPipe } from '../common/day.pipe';
import { IdPipe } from '../common/id.pipe';
import { CommentItem, CommentsService } from './comments.service';

@Controller('groups/:id/days/:day/submissions/:memberId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  async list(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
  ): Promise<{ items: CommentItem[] }> {
    return { items: await this.comments.list(auth.subject, id, day, memberId) };
  }

  @Post()
  add(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
    @Body() body: { text?: unknown },
  ): Promise<CommentItem> {
    return this.comments.add(auth.subject, id, day, memberId, body?.text);
  }

  @Delete(':commentId')
  @HttpCode(204)
  async remove(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Param('memberId', IdPipe) memberId: string,
    @Param('commentId', IdPipe) commentId: string,
  ): Promise<void> {
    await this.comments.delete(auth.subject, id, day, memberId, commentId);
  }
}
