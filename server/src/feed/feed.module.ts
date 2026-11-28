import { Module } from '@nestjs/common';
import { PhotosModule } from '../photos/photos.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [PhotosModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
