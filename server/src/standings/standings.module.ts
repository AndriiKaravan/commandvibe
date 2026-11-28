import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { PhotosModule } from '../photos/photos.module';
import { PointsModule } from '../points/points.module';
import { StandingsController } from './standings.controller';
import { StandingsService } from './standings.service';

@Module({
  imports: [GroupsModule, PhotosModule, PointsModule],
  controllers: [StandingsController],
  providers: [StandingsService],
})
export class StandingsModule {}
