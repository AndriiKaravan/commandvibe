import { inQuietHours, localDayStart } from './quiet-hours';

const kyiv = 'Europe/Kyiv';

describe('quiet hours', () => {
  it('should be quiet from 22:00 up to 08:00 group time and not otherwise', () => {
    expect(inQuietHours(new Date('2026-12-02T19:59:00Z'), kyiv)).toBe(false);
    expect(inQuietHours(new Date('2026-12-02T20:00:00Z'), kyiv)).toBe(true);
    expect(inQuietHours(new Date('2026-12-03T05:59:00Z'), kyiv)).toBe(true);
    expect(inQuietHours(new Date('2026-12-03T06:00:00Z'), kyiv)).toBe(false);
  });

  it('should follow summer time', () => {
    expect(inQuietHours(new Date('2026-07-02T18:59:00Z'), kyiv)).toBe(false);
    expect(inQuietHours(new Date('2026-07-02T19:00:00Z'), kyiv)).toBe(true);
  });

  it('should use the group’s zone rather than the server’s', () => {
    expect(inQuietHours(new Date('2026-12-02T20:00:00Z'), 'America/New_York')).toBe(false);
    expect(inQuietHours(new Date('2026-12-03T03:00:00Z'), 'America/New_York')).toBe(true);
  });

  it('should start the local day at local midnight', () => {
    expect(localDayStart(new Date('2026-12-02T09:00:00Z'), kyiv)).toEqual(new Date('2026-12-01T22:00:00Z'));
  });

  it('should keep the day start right across the spring clock change', () => {
    expect(localDayStart(new Date('2027-03-28T12:00:00Z'), kyiv)).toEqual(new Date('2027-03-27T22:00:00Z'));
    expect(localDayStart(new Date('2027-03-29T12:00:00Z'), kyiv)).toEqual(new Date('2027-03-28T21:00:00Z'));
  });
});
