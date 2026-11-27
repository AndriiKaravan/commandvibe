import { ServiceUnavailableException } from '@nestjs/common';

/** Thrown when the server is at its limit; the controller adds `Retry-After`. */
export class BusyException extends ServiceUnavailableException {
  constructor() {
    super('busy');
  }
}

/**
 * Limits concurrent work so a few large uploads cannot exhaust the single instance's memory.
 * Beyond [max] running and [maxWaiting] queued, new work is refused at once rather than piled up.
 */
export class Semaphore {
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly max: number,
    private readonly maxWaiting: number,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.running >= this.max) {
      if (this.waiting.length >= this.maxWaiting) {
        throw new BusyException();
      }
      // The slot is handed over directly, so `running` stays unchanged.
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.running++;
    }
    try {
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) {
        next();
      } else {
        this.running--;
      }
    }
  }
}
