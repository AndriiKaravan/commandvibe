import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsFacade } from './notifications.facade';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [GroupsModule, PhotosModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsFacade],
  exports: [NotificationsService],
})
export class NotificationsModule {}
