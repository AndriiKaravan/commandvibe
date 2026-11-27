import { takenAtOf } from './exif-time';

describe('takenAtOf', () => {
  const now = new Date('2026-12-05T10:00:00Z');

  it('should read the wall time in the group zone when there is no offset', () => {
    expect(takenAtOf({ wall: '2026-12-01 08:59:00' }, 'Europe/Kyiv', now)?.toISOString()).toBe(
      '2026-12-01T06:59:00.000Z',
    );
  });

  it('should trust an explicit offset', () => {
    expect(takenAtOf({ wall: '2026-12-01 08:59:00', offset: '+01:00' }, 'Europe/Kyiv', now)?.toISOString()).toBe(
      '2026-12-01T07:59:00.000Z',
    );
  });

  it('should drop absent, ancient and future times', () => {
    expect(takenAtOf(undefined, 'Europe/Kyiv', now)).toBeUndefined();
    expect(takenAtOf({ wall: '1999-12-31 23:00:00' }, 'Europe/Kyiv', now)).toBeUndefined();
    expect(takenAtOf({ wall: '2026-12-08 10:00:00' }, 'Europe/Kyiv', now)).toBeUndefined();
  });
});
