import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { CLOCK } from '../src/auth/session.service';
import { APP_CHECK_MODE, AppCheckMode } from '../src/shared/app_check';
import { FirebaseService, VerifiedFirebaseUser } from '../src/firebase/firebase.service';
import { OidcVerifier, TICK_CONFIG, TickConfig, OIDC_VERIFIER } from '../src/game/tick.guard';
import { configureApp } from '../src/main';

/** Firebase Auth stand-in: an id token is a key of [users]. */
export class FakeFirebase implements Pick<FirebaseService, 'verifyIdToken'> {
  readonly users = new Map<string, VerifiedFirebaseUser>();

  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
    const user = this.users.get(idToken);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

/** Boots the real application module on a random port for e2e tests. */
export async function createTestApp(
  options: {
    firebase?: FakeFirebase;
    appCheckMode?: AppCheckMode;
    testSeed?: boolean;
    tick?: { config: TickConfig; verifier: OidcVerifier };
    /** Replaces the server clock; tests move time by assigning `clock.now`. */
    clock?: { now: Date };
  } = {},
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule.forRoot({ storage: 'memory', testSeed: options.testSeed })],
  })
    .overrideProvider(FirebaseService)
    .useValue(options.firebase ?? new FakeFirebase())
    .overrideProvider(APP_CHECK_MODE)
    .useValue(options.appCheckMode ?? 'off');
  const clock = options.clock;
  if (clock) {
    builder.overrideProvider(CLOCK).useValue(() => new Date(clock.now));
  }
  if (options.tick) {
    builder
      .overrideProvider(TICK_CONFIG)
      .useValue(options.tick.config)
      .overrideProvider(OIDC_VERIFIER)
      .useValue(options.tick.verifier);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  return app;
}
