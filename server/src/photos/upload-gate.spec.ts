import { ServiceUnavailableException } from '@nestjs/common';
import { Semaphore } from './upload-gate';

describe('Semaphore', () => {
  function deferred() {
    let release!: () => void;
    const done = new Promise<void>((resolve) => (release = resolve));
    return { done, release };
  }

  it('should say busy when the limit and the queue are both full', async () => {
    const gate = new Semaphore(2, 0);
    const a = deferred();
    const b = deferred();
    const first = gate.run(() => a.done);
    const second = gate.run(() => b.done);
    await expect(gate.run(async () => 'third')).rejects.toBeInstanceOf(ServiceUnavailableException);
    a.release();
    b.release();
    await Promise.all([first, second]);
    await expect(gate.run(async () => 'later')).resolves.toBe('later');
  });

  it('should queue up to the waiting limit and run in order', async () => {
    const gate = new Semaphore(1, 2);
    const order: string[] = [];
    const first = deferred();
    const running = gate.run(async () => {
      await first.done;
      order.push('first');
    });
    const queued = [gate.run(async () => void order.push('second')), gate.run(async () => void order.push('third'))];
    await expect(gate.run(async () => 'fourth')).rejects.toBeInstanceOf(ServiceUnavailableException);
    first.release();
    await Promise.all([running, ...queued]);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('should free the slot when the work throws', async () => {
    const gate = new Semaphore(1, 0);
    await expect(
      gate.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(gate.run(async () => 'ok')).resolves.toBe('ok');
  });
});
