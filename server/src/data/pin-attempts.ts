import { MemberSecrets } from './models';

/** Pure rule shared by every repository: what one more PIN attempt does to the secrets. */
export function nextPinAttempt(
  secrets: MemberSecrets,
  now: Date,
  max: number,
  lockMs: number,
): { kind: 'attempt'; attempt: number; patch: Partial<MemberSecrets> } | { kind: 'locked'; lockedUntil: Date } {
  if (secrets.lockedUntil && secrets.lockedUntil.getTime() > now.getTime()) {
    return { kind: 'locked', lockedUntil: secrets.lockedUntil };
  }
  // An expired lock starts a fresh series of attempts.
  const attempt = (secrets.lockedUntil ? 0 : secrets.pinFailures) + 1;
  const lockedUntil = attempt >= max ? new Date(now.getTime() + lockMs) : undefined;
  return { kind: 'attempt', attempt, patch: { pinFailures: attempt, lockedUntil } };
}
