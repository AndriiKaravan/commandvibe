// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
import { readAppCheckMode } from './app-check.mode';

describe('readAppCheckMode', () => {
  it('should default to monitor when unset', () => {
    expect(readAppCheckMode({})).toBe('monitor');
    expect(readAppCheckMode({ APP_CHECK_MODE: '' })).toBe('monitor');
  });

  it('should accept off, monitor, enforce case-insensitively', () => {
    expect(readAppCheckMode({ APP_CHECK_MODE: 'off' })).toBe('off');
    expect(readAppCheckMode({ APP_CHECK_MODE: 'monitor' })).toBe('monitor');
    expect(readAppCheckMode({ APP_CHECK_MODE: ' Enforce ' })).toBe('enforce');
  });

  it('should fall back to monitor and warn on an unknown value', () => {
    const warn = jest.fn();
    expect(readAppCheckMode({ APP_CHECK_MODE: 'strict' }, warn)).toBe(
      'monitor',
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('strict'));
  });

  it('should not warn when the value is valid or unset', () => {
    const warn = jest.fn();
    readAppCheckMode({}, warn);
    readAppCheckMode({ APP_CHECK_MODE: 'enforce' }, warn);
    expect(warn).not.toHaveBeenCalled();
  });
});
