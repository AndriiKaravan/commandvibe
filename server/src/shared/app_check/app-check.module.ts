// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
import { Logger, Module } from '@nestjs/common';

import { APP_CHECK_MODE, APP_CHECK_VERIFIER } from './app-check.constants';
import { AppCheckGuard } from './app-check.guard';
import { readAppCheckMode } from './app-check.mode';
import { FirebaseAppCheckVerifier } from './app-check.verifier';

/**
 * Provides {@link AppCheckGuard} with the mode from `APP_CHECK_MODE` and the
 * `firebase-admin` verifier. The backend registers the guard itself as an
 * `APP_GUARD`, after its `AuthGuard`.
 */
@Module({
  providers: [
    {
      provide: APP_CHECK_MODE,
      useFactory: () =>
        readAppCheckMode(process.env, (message) =>
          new Logger('AppCheck').warn(message),
        ),
    },
    { provide: APP_CHECK_VERIFIER, useClass: FirebaseAppCheckVerifier },
    AppCheckGuard,
  ],
  exports: [AppCheckGuard, APP_CHECK_MODE, APP_CHECK_VERIFIER],
})
export class AppCheckModule {}
