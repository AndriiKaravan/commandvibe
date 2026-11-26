// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
/** Upper bound for every app callback; a hung Firestore read must not hold a socket forever. */
export const CALLBACK_TIMEOUT_MS = 10_000;

/** Runs `call` and rejects if it throws (sync or async) or does not settle within `ms`. */
export function callWithTimeout<T>(call: () => Promise<T>, label: string, ms = CALLBACK_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    // A hung callback must not delay process exit after shutdown.
    timer.unref();
  });
  return Promise.race([Promise.resolve().then(call), timeout]).finally(() => clearTimeout(timer));
}
