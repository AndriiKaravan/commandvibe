// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import type { RealtimeLogger } from './options';

/**
 * Message passed between server instances. Events carry the frame already
 * encoded so every instance sends identical bytes (same event id).
 */
export type BroadcastMessage =
  | {
      kind: 'event';
      origin: string;
      topic: string;
      frame: string;
      exceptUserId?: string;
      /** Skipped only when both match: a sid alone is untrusted client input. */
      exceptSession?: { sid: string; userId: string };
    }
  | { kind: 'disconnectUser'; origin: string; userId: string }
  | { kind: 'refreshTopics'; origin: string; userId: string };

/** Fans messages out to every server instance, including the sender. */
export interface BroadcastAdapter {
  publish(message: BroadcastMessage): Promise<void>;
  subscribe(handler: (message: BroadcastMessage) => void): void;
  close(): Promise<void>;
}

/** Single-process adapter: delivers synchronously to this process only. */
export class InProcessBroadcastAdapter implements BroadcastAdapter {
  private handlers: ((message: BroadcastMessage) => void)[] = [];
  private closed = false;

  constructor(private readonly logger?: RealtimeLogger) {}

  async publish(message: BroadcastMessage): Promise<void> {
    if (this.closed) return;
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch (error) {
        // One failing handler must not stop delivery to the others.
        this.logger?.error('realtime.adapter_handler_failed', {
          kind: message.kind,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  subscribe(handler: (message: BroadcastMessage) => void): void {
    this.handlers.push(handler);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.handlers = [];
  }
}
