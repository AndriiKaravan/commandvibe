// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
import { getAppCheck } from 'firebase-admin/app-check';

/** Verifies an App Check token and tells which Firebase app it belongs to. */
export interface AppCheckVerifier {
  verify(token: string): Promise<{ appId: string }>;
}

/**
 * {@link AppCheckVerifier} backed by `firebase-admin`.
 *
 * `getAppCheck()` is resolved on every call rather than in the constructor,
 * so a backend whose admin app is not initialised yet fails at request time
 * — where the guard turns it into a logged `error` — instead of at boot.
 */
export class FirebaseAppCheckVerifier implements AppCheckVerifier {
  async verify(token: string): Promise<{ appId: string }> {
    const result = await getAppCheck().verifyToken(token);
    return { appId: result.appId };
  }
}

/**
 * True when `firebase-admin` rejected the token itself (`app-check/*`), as
 * opposed to failing for an infrastructure reason such as `app/no-app`.
 */
export function isAppCheckTokenError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('app-check/');
}
