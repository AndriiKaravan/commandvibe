import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { IdPipe } from '../common/id.pipe';
import { NotificationPrefs } from './preferences';
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

@Controller('groups/:id/me/notification-settings')
export class NotificationSettingsController {
  constructor(private readonly facade: NotificationsFacade) {}

  @Get()
  get(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
  ): Promise<NotificationPrefs & { playing: boolean }> {
    return this.facade.settings(auth.subject, id);
  }

  @Put()
  @HttpCode(204)
  async set(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.facade.setSettings(auth.subject, id, body);
  }
}
