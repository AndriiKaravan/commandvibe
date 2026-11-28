import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [GroupsModule, PhotosModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
