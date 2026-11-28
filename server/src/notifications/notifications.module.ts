import { Global, Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { NOTIFICATION_SINK, REMINDER_RUNNER } from './notification-sink';
import { NOTIFICATION_DELIVERY, NotificationSources } from './notification-sources';
import { PushNotifier } from './push-notifier';
import { NotificationSettingsController, NotificationsController } from './notifications.controller';
import { NotificationsFacade } from './notifications.facade';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';

@Global()
@Module({
  imports: [GroupsModule, PhotosModule],
  controllers: [NotificationsController, NotificationSettingsController],
  providers: [
    NotificationsService,
    NotificationsFacade,
    NotificationSources,
    PushNotifier,
    RemindersService,
    { provide: REMINDER_RUNNER, useExisting: RemindersService },
    { provide: NOTIFICATION_DELIVERY, useExisting: PushNotifier },
    { provide: NOTIFICATION_SINK, useExisting: NotificationSources },
  ],
  exports: [NotificationsService, NOTIFICATION_SINK, REMINDER_RUNNER],
})
export class NotificationsModule {}
