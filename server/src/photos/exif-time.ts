import { zonedToUtc } from '../game/game-time';

export interface ExifTime {
  /** `YYYY-MM-DD HH:mm:ss` as printed by the camera. */
  wall: string;
  /** `±HH:mm` when the camera recorded it. */
  offset?: string;
}

const wallPattern = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const offsetPattern = /^([+-])(\d{2}):(\d{2})$/;
const earliest = Date.UTC(2000, 0, 1);
const dayMs = 24 * 60 * 60 * 1000;

/** The instant a photo was taken, or undefined when EXIF is missing or implausible. */
export function takenAtOf(exif: ExifTime | undefined, timeZone: string, now: Date): Date | undefined {
  const match = exif ? wallPattern.exec(exif.wall) : null;
  if (!exif || !match) {
    return undefined;
  }
  const [, year, month, day, hour, minute, second] = match;
  const offset = exif.offset ? offsetPattern.exec(exif.offset) : null;
  let taken: Date;
  if (offset) {
    const sign = offset[1] === '-' ? -1 : 1;
    const offsetMs = sign * (Number(offset[2]) * 60 + Number(offset[3])) * 60_000;
    taken = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) - offsetMs,
    );
  } else {
    taken = new Date(
      zonedToUtc(`${year}-${month}-${day}`, `${hour}:${minute}`, timeZone).getTime() + Number(second) * 1000,
    );
  }
  const time = taken.getTime();
  if (Number.isNaN(time) || time < earliest || time > now.getTime() + dayMs) {
    return undefined;
  }
  return taken;
}
