import { addDays, dayOpensAt, isValidDate, isValidTime, localDate, zonedToUtc } from './game-time';

describe('game time', () => {
  describe('zonedToUtc', () => {
    it('should convert Kyiv winter time (UTC+2)', () => {
      expect(zonedToUtc('2026-12-01', '09:00', 'Europe/Kyiv').toISOString()).toBe('2026-12-01T07:00:00.000Z');
    });

    it('should follow the spring DST change in Kyiv', () => {
      expect(zonedToUtc('2027-03-27', '09:00', 'Europe/Kyiv').toISOString()).toBe('2027-03-27T07:00:00.000Z');
      expect(zonedToUtc('2027-03-28', '09:00', 'Europe/Kyiv').toISOString()).toBe('2027-03-28T06:00:00.000Z');
    });

    it('should follow the autumn DST change in Kyiv', () => {
      expect(zonedToUtc('2027-10-30', '09:00', 'Europe/Kyiv').toISOString()).toBe('2027-10-30T06:00:00.000Z');
      expect(zonedToUtc('2027-10-31', '09:00', 'Europe/Kyiv').toISOString()).toBe('2027-10-31T07:00:00.000Z');
    });

    it('should convert a zone west of UTC', () => {
      expect(zonedToUtc('2026-12-01', '09:00', 'America/New_York').toISOString()).toBe('2026-12-01T14:00:00.000Z');
    });
  });

  describe('localDate', () => {
    it('should roll over at local midnight, not at UTC midnight', () => {
      expect(localDate(new Date('2026-12-01T22:30:00Z'), 'Europe/Kyiv')).toBe('2026-12-02');
      expect(localDate(new Date('2026-12-01T21:59:00Z'), 'Europe/Kyiv')).toBe('2026-12-01');
    });
  });

  describe('addDays', () => {
    it('should cross month and year ends', () => {
      expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
      expect(addDays('2027-02-27', 2)).toBe('2027-03-01');
      expect(addDays('2026-12-01', 0)).toBe('2026-12-01');
    });
  });

  describe('dayOpensAt', () => {
    it('should open day N at openTime of startDate + N in the group zone', () => {
      const game = { startDate: '2027-03-27', openTime: '09:00' };
      expect(dayOpensAt(game, 0, 'Europe/Kyiv').toISOString()).toBe('2027-03-27T07:00:00.000Z');
      expect(dayOpensAt(game, 2, 'Europe/Kyiv').toISOString()).toBe('2027-03-29T06:00:00.000Z');
    });
  });

  describe('validators', () => {
    it('should reject impossible dates and times', () => {
      expect(isValidDate('2026-02-30')).toBe(false);
      expect(isValidDate('2026-2-3')).toBe(false);
      expect(isValidDate('2026-12-01')).toBe(true);
      expect(isValidTime('24:00')).toBe(false);
      expect(isValidTime('9:00')).toBe(false);
      expect(isValidTime('09:60')).toBe(false);
      expect(isValidTime('23:59')).toBe(true);
    });
  });
});
