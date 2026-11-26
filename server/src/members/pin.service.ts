import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/** PIN hashing (design 6: argon2). */
@Injectable()
export class PinService {
  hash(pin: string): Promise<string> {
    return argon2.hash(pin, { type: argon2.argon2id });
  }

  async verify(hash: string, pin: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, pin);
    } catch {
      return false;
    }
  }
}
