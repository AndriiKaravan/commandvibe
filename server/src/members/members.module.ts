import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { PhotosService } from '../photos/photos.service';
import { GroupRealtimeModule } from '../realtime/group-realtime.module';
import { RealtimeMemberEvents } from '../realtime/realtime-access';
import { InvitePageController } from './invite-page.controller';
import { JoinController } from './join.controller';
import { MembersController } from './members.controller';
import { MEMBER_DATA_CLEANUP, MEMBER_EVENTS, MembersService } from './members.service';
import { PinService } from './pin.service';

@Module({
  imports: [GroupsModule, GroupRealtimeModule, PhotosModule],
  controllers: [JoinController, MembersController, InvitePageController],
  providers: [
    MembersService,
    PinService,
    { provide: MEMBER_EVENTS, useExisting: RealtimeMemberEvents },
    { provide: MEMBER_DATA_CLEANUP, useExisting: PhotosService },
  ],
  exports: [MembersService],
})
export class MembersModule {}
