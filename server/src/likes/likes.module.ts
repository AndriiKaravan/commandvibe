import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

@Module({
  imports: [GroupsModule, PhotosModule],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
