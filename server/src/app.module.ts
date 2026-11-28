import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { DataModule } from './data/data.module';
import { FeedModule } from './feed/feed.module';
import { GameModule } from './game/game.module';
import { GroupsModule } from './groups/groups.module';
import { LikesModule } from './likes/likes.module';
import { MembersModule } from './members/members.module';
import { HealthController } from './health/health.controller';
import { PhotosModule } from './photos/photos.module';
import { PointsModule } from './points/points.module';
import { ProgressModule } from './progress/progress.module';
import { AppCheckGuard, AppCheckModule } from './shared/app_check';
import { StandingsModule } from './standings/standings.module';
import { TestSeedModule } from './testing/test-seed.module';

export interface AppOptions {
  /** `memory` for tests and local runs, `firestore` in Cloud Run. */
  storage: 'memory' | 'firestore';
  /** Mounts /test/seed-group; only for app integration tests (NODE_ENV=test). */
  testSeed?: boolean;
}

@Module({})
export class AppModule {
  static forRoot(options: AppOptions): DynamicModule {
    return {
      module: AppModule,
      // AuthModule registers AuthGuard first; App Check runs after it, as ks_core prescribes.
      imports: [
        DataModule.forRoot(options.storage),
        AuthModule,
        AppCheckModule,
        GroupsModule,
        GameModule,
        MembersModule,
        PhotosModule,
        LikesModule,
        CommentsModule,
        FeedModule,
        PointsModule,
        ProgressModule,
        StandingsModule,
        ...(options.testSeed ? [TestSeedModule] : []),
      ],
      controllers: [HealthController],
      providers: [
        { provide: 'APP_OPTIONS', useValue: options },
        { provide: APP_GUARD, useExisting: AppCheckGuard },
      ],
    };
  }
}
