import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// Group and member ids are 10 random bytes in hex; anything else never reaches a database path.
const idPattern = /^[a-f0-9]{20}$/;

@Injectable()
export class IdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !idPattern.test(value)) {
      throw new BadRequestException('invalid_id');
    }
    return value;
  }
}
