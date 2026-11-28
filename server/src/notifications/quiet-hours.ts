const quietFromHour = 22;
const quietUntilHour = 8;

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function localParts(at: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
  }).formatToParts(at);
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour') };
}

/** Milliseconds the zone is ahead of UTC at [at] (whole hours are enough for the zones in use). */
function offsetMs(at: Date, timeZone: string): number {
  const local = localParts(at, timeZone);
  const minute = Math.floor(at.getTime() / 60000) * 60000;
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, at.getUTCMinutes()) - minute;
}

/** True between 22:00 and 08:00 on the group's clock, when pushes stay silent. */
export function inQuietHours(at: Date, timeZone: string): boolean {
  const { hour } = localParts(at, timeZone);
  return hour >= quietFromHour || hour < quietUntilHour;
}

/** The UTC instant at which the group's current local day began. */
export function localDayStart(at: Date, timeZone: string): Date {
  const { year, month, day } = localParts(at, timeZone);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  let start = midnightAsUtc - offsetMs(new Date(midnightAsUtc), timeZone);
  // The offset at the guess may differ from the offset at real local midnight around a clock change.
  start = midnightAsUtc - offsetMs(new Date(start), timeZone);
  return new Date(start);
}
