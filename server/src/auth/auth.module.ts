import { randomBytes } from 'node:crypto';
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CLOCK, SESSION_SIGNING_KEY, SessionService } from './session.service';

function signingKey(): string {
  const key = process.env.SESSION_SIGNING_KEY;
  if (key && key.length >= 32) {
    return key;
  }
  if (process.env.STORAGE === 'firestore' || process.env.K_SERVICE) {
    // Cloud Run without the secret would sign with a key that dies with the instance.
    throw new Error('SESSION_SIGNING_KEY (>= 32 chars) is required outside local runs');
  }
  return randomBytes(32).toString('hex');
}

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    { provide: SESSION_SIGNING_KEY, useFactory: signingKey },
    { provide: CLOCK, useValue: () => new Date() },
    SessionService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionService, CLOCK, SESSION_SIGNING_KEY],
})
export class AuthModule {}
