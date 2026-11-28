import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [GroupsModule, PhotosModule],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
