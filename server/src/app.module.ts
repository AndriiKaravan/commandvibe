import { DynamicModule, Module } from '@nestjs/common';
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
      controllers: [HealthController],
      providers: [{ provide: 'APP_OPTIONS', useValue: options }],
    };
  }
}
