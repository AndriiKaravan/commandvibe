import { DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DataModule } from './data/data.module';
import { HealthController } from './health/health.controller';

export interface AppOptions {
  /** `memory` for tests and local runs, `firestore` in Cloud Run. */
  storage: 'memory' | 'firestore';
}

@Module({})
export class AppModule {
  static forRoot(options: AppOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [DataModule.forRoot(options.storage), AuthModule],
      controllers: [HealthController],
      providers: [{ provide: 'APP_OPTIONS', useValue: options }],
    };
  }
}
