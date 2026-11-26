// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { BroadcastMessage, InProcessBroadcastAdapter } from './broadcast-adapter';

const message: BroadcastMessage = { kind: 'disconnectUser', origin: 'i1', userId: 'u1' };

describe('InProcessBroadcastAdapter', () => {
  it('should deliver a published message before publish resolves', async () => {
    const adapter = new InProcessBroadcastAdapter();
    const received: BroadcastMessage[] = [];
    adapter.subscribe((m) => received.push(m));
    const pending = adapter.publish(message);
    expect(received).toEqual([message]);
    await pending;
  });

  it('should not deliver after close', async () => {
    const adapter = new InProcessBroadcastAdapter();
    const handler = jest.fn();
    adapter.subscribe(handler);
    await adapter.close();
    await adapter.publish(message);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should still call other handlers and resolve when one handler throws', async () => {
    const adapter = new InProcessBroadcastAdapter();
    const second = jest.fn();
    adapter.subscribe(() => {
      throw new Error('boom');
    });
    adapter.subscribe(second);
    await expect(adapter.publish(message)).resolves.toBeUndefined();
    expect(second).toHaveBeenCalledWith(message);
  });

  it('should log a throwing handler instead of swallowing it', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const adapter = new InProcessBroadcastAdapter(logger);
    adapter.subscribe(() => {
      throw new Error('boom');
    });
    await adapter.publish(message);
    expect(logger.error).toHaveBeenCalledWith('realtime.adapter_handler_failed', expect.objectContaining({ error: 'boom' }));
  });
});
