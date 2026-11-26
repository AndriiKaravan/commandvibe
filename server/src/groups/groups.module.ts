import { Module } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { OrganizerAuthController } from '../organizers/organizer-auth.controller';
import { GroupsController } from './groups.controller';
import { GroupsService, PUBLIC_APP_URL } from './groups.service';

@Module({
  controllers: [OrganizerAuthController, GroupsController],
  providers: [
    FirebaseService,
    GroupsService,
    { provide: PUBLIC_APP_URL, useValue: process.env.PUBLIC_APP_URL ?? 'http://localhost:8080' },
  ],
  exports: [GroupsService, PUBLIC_APP_URL],
})
export class GroupsModule {}
