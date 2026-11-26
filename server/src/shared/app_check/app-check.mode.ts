// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
import { APP_CHECK_MODES, AppCheckMode } from './app-check.constants';

const DEFAULT_MODE: AppCheckMode = 'monitor';

/**
 * Reads `APP_CHECK_MODE` from the environment.
 *
 * Unset or unknown values fall back to `monitor`: a typo in a deploy must
 * never silently switch rejection on or off.
 */
export function readAppCheckMode(
  env: NodeJS.ProcessEnv,
  warn: (message: string) => void = () => {},
): AppCheckMode {
  const raw = env.APP_CHECK_MODE;
  if (raw === undefined || raw.trim() === '') return DEFAULT_MODE;
  const normalized = raw.trim().toLowerCase();
  if ((APP_CHECK_MODES as readonly string[]).includes(normalized)) {
    return normalized as AppCheckMode;
  }
  warn(`APP_CHECK_MODE="${raw}" is unknown, using ${DEFAULT_MODE}`);
  return DEFAULT_MODE;
}
