import { Global, Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { NOTIFICATION_SINK } from './notification-sink';
import { NotificationSources } from './notification-sources';
import { NotificationsController } from './notifications.controller';
import { NotificationsFacade } from './notifications.facade';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [GroupsModule, PhotosModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsFacade,
    NotificationSources,
    { provide: NOTIFICATION_SINK, useExisting: NotificationSources },
  ],
  exports: [NotificationsService, NOTIFICATION_SINK],
})
export class NotificationsModule {}
