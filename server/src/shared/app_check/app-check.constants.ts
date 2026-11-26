// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
/** Request header carrying the Firebase App Check token (lower-cased by Node). */
export const APP_CHECK_HEADER = 'x-firebase-appcheck';

/** `code` in the 401 body when the guard rejects a request in `enforce`. */
export const APP_CHECK_FAILED = 'APP_CHECK_FAILED';

/**
 * Metadata key set by the backend's `@Public()` decorator. Kept as a literal
 * so this module never imports a backend file; both backends use `isPublic`.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/** DI token resolving to the active {@link AppCheckMode}. */
export const APP_CHECK_MODE = Symbol('APP_CHECK_MODE');

/** DI token resolving to the {@link AppCheckVerifier} implementation. */
export const APP_CHECK_VERIFIER = Symbol('APP_CHECK_VERIFIER');

export type AppCheckMode = 'off' | 'monitor' | 'enforce';

export type AppCheckOutcome = 'verified' | 'missing' | 'invalid' | 'error';

export const APP_CHECK_MODES: readonly AppCheckMode[] = [
  'off',
  'monitor',
  'enforce',
];
