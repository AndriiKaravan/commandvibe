import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [GroupsModule, PhotosModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
