import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { DataModule } from './data/data.module';
import { GroupsModule } from './groups/groups.module';
import { MembersModule } from './members/members.module';
import { HealthController } from './health/health.controller';
import { AppCheckGuard, AppCheckModule } from './shared/app_check';

export interface AppOptions {
  /** `memory` for tests and local runs, `firestore` in Cloud Run. */
  storage: 'memory' | 'firestore';
}

@Module({})
export class AppModule {
  static forRoot(options: AppOptions): DynamicModule {
    return {
      module: AppModule,
      // AuthModule registers AuthGuard first; App Check runs after it, as ks_core prescribes.
      imports: [DataModule.forRoot(options.storage), AuthModule, AppCheckModule, GroupsModule, MembersModule],
      controllers: [HealthController],
      providers: [{ provide: 'APP_OPTIONS', useValue: options }, { provide: APP_GUARD, useExisting: AppCheckGuard }],
    };
  }
}
