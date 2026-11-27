import { BadRequestException, PipeTransform } from '@nestjs/common';

/** A day number in the URL: 0..30 (a game lasts at most 31 days); services check it against the game. */
export class DayPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (typeof value !== 'string' || !/^\d{1,2}$/.test(value) || Number(value) > 30) {
      throw new BadRequestException('invalid_day');
    }
    return Number(value);
  }
}
