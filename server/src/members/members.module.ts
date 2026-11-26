import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { GroupRealtimeModule } from '../realtime/group-realtime.module';
import { RealtimeMemberEvents } from '../realtime/realtime-access';
import { InvitePageController } from './invite-page.controller';
import { JoinController } from './join.controller';
import { MembersController } from './members.controller';
import { MEMBER_EVENTS, MembersService } from './members.service';
import { PinService } from './pin.service';

@Module({
  imports: [GroupsModule, GroupRealtimeModule],
  controllers: [JoinController, MembersController, InvitePageController],
  providers: [MembersService, PinService, { provide: MEMBER_EVENTS, useExisting: RealtimeMemberEvents }],
  exports: [MembersService],
})
export class MembersModule {}
