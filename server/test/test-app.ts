import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { FirebaseService, VerifiedFirebaseUser } from '../src/firebase/firebase.service';
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
export async function createTestApp(options: { firebase?: FakeFirebase } = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot({ storage: 'memory' })] })
    .overrideProvider(FirebaseService)
    .useValue(options.firebase ?? new FakeFirebase())
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  return app;
}
