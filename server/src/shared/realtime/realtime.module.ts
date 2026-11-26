// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { DynamicModule, Logger, ModuleMetadata, Module } from '@nestjs/common';
import { RealtimeLogger, RealtimeOptions, resolveOptions } from './options';
import { RealtimeHub } from './realtime-hub';
import { REALTIME_HUB, REALTIME_OPTIONS } from './realtime.tokens';
import { RealtimeService } from './realtime.service';

export interface RealtimeModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => RealtimeOptions | Promise<RealtimeOptions>;
}

function nestLogger(): RealtimeLogger {
  const logger = new Logger('Realtime');
  const line = (message: string, fields?: object) =>
    fields ? `${message} ${JSON.stringify(fields)}` : message;
  return {
    info: (message, fields) => logger.log(line(message, fields)),
    warn: (message, fields) => logger.warn(line(message, fields)),
    error: (message, fields) => logger.error(line(message, fields)),
  };
}

/** WebSocket realtime for a NestJS backend. Import once, in the root module. */
@Module({})
export class RealtimeModule {
  static forRootAsync(options: RealtimeModuleAsyncOptions): DynamicModule {
    return {
      module: RealtimeModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        { provide: REALTIME_OPTIONS, useFactory: options.useFactory, inject: options.inject ?? [] },
        {
          provide: REALTIME_HUB,
          useFactory: (raw: RealtimeOptions) =>
            new RealtimeHub(resolveOptions({ ...raw, logger: raw.logger ?? nestLogger() })),
          inject: [REALTIME_OPTIONS],
        },
        RealtimeService,
      ],
      exports: [RealtimeService],
    };
  }
}
