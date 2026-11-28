import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { IdPipe } from '../common/id.pipe';
import { NotificationsFacade } from './notifications.facade';
import { NotificationsPage } from './notifications.service';

@Controller('groups/:id/notifications')
export class NotificationsController {
  constructor(private readonly facade: NotificationsFacade) {}

  @Get()
  list(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<NotificationsPage> {
    return this.facade.list(auth.subject, id);
  }

  @Post('read')
  @HttpCode(204)
  async read(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Body() body: { ids?: unknown },
  ): Promise<void> {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : undefined;
    await this.facade.markRead(auth.subject, id, ids);
  }
}
