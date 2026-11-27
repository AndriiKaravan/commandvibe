import { Module } from '@nestjs/common';
import { SESSION_SIGNING_KEY } from '../auth/session.service';
import { GameModule } from '../game/game.module';
import { GroupsModule } from '../groups/groups.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { PhotoFileController } from './photo-file.controller';
import { PHOTO_EVENTS, RealtimePhotoEvents } from './photo-events';
import { PhotoUrlSigner, derivePhotoUrlKey } from './photo-url';
import { PHOTO_URL_SIGNER } from './photo-url.token';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [GroupsModule, GameModule],
  controllers: [PhotosController, PhotoFileController, ModerationController],
  providers: [
    PhotosService,
    ModerationService,
    RealtimePhotoEvents,
    { provide: PHOTO_EVENTS, useExisting: RealtimePhotoEvents },
    {
      provide: PHOTO_URL_SIGNER,
      inject: [SESSION_SIGNING_KEY],
      useFactory: (key: string) => new PhotoUrlSigner(derivePhotoUrlKey(Buffer.from(key, 'utf8'))),
    },
  ],
  exports: [PhotosService],
})
export class PhotosModule {}
