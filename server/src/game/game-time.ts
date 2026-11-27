/** Calendar maths in the group's time zone; days open at a local wall-clock time, DST included. */

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDate(value: string): boolean {
  const match = datePattern.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function isValidTime(value: string): boolean {
  return timePattern.test(value);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Offset of [timeZone] from UTC at [instant], in ms (positive east of UTC). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant at which the wall clock of [timeZone] shows [date] [time]. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle on the right offset on both sides of a DST change.
  let guess = wall - zoneOffsetMs(new Date(wall), timeZone);
  guess = wall - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** The calendar date (YYYY-MM-DD) it is in [timeZone] at [instant]. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * When a day's photos become visible to everyone: 9:00 two days after the scheduled date. It follows `opensAt`,
 * not the real opening, so a late-opened day still reveals on schedule.
 */
export function revealAt(opensAt: Date, timeZone: string): Date {
  return zonedToUtc(addDays(localDate(opensAt, timeZone), 2), '09:00', timeZone);
}

export function dayOpensAt(game: { startDate: string; openTime: string }, dayIndex: number, timeZone: string): Date {
  return zonedToUtc(addDays(game.startDate, dayIndex), game.openTime, timeZone);
}
