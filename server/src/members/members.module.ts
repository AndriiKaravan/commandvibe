import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { InvitePageController } from './invite-page.controller';
import { JoinController } from './join.controller';
import { MembersController } from './members.controller';
import { MEMBER_EVENTS, MemberEvents, MembersService } from './members.service';
import { PinService } from './pin.service';

const noEvents: MemberEvents = { joined() {}, approved() {}, removed() {} };

@Module({
  imports: [GroupsModule],
  controllers: [JoinController, MembersController, InvitePageController],
  providers: [MembersService, PinService, { provide: MEMBER_EVENTS, useValue: noEvents }],
  exports: [MembersService],
})
export class MembersModule {}
