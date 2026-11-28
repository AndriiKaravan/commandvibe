// generated from ks_server/push — do not edit; run: npm run sync:push
import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { createPushTokensController } from './push-tokens.controller';
import { PushService } from './push.service';
import { PushOptions } from './push.types';
import { PUSH_OPTIONS } from './push.tokens';

export interface PushModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** Route of the token endpoint (PUT/DELETE). Default `me/push-token`. */
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => PushOptions | Promise<PushOptions>;
}

/** Device push tokens and personal pushes. Import once, in the root module. */
@Module({})
export class PushModule {
  static forRootAsync(options: PushModuleAsyncOptions): DynamicModule {
    return {
      module: PushModule,
      global: true,
      imports: options.imports ?? [],
      controllers: [createPushTokensController(options.path ?? 'me/push-token')],
      providers: [
        { provide: PUSH_OPTIONS, useFactory: options.useFactory, inject: options.inject ?? [] },
        PushService,
      ],
      exports: [PushService],
    };
  }
}
