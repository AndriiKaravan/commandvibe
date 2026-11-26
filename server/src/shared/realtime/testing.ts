// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { RealtimeSocket } from './realtime-hub';

/** In-memory socket for unit tests: records frames sent and how it was closed. */
export class FakeSocket implements RealtimeSocket {
  readonly sent: Record<string, unknown>[] = [];
  closed?: { code: number; reason?: string };
  terminated = false;
  pings = 0;
  bufferedAmount = 0;

  ping(): void {
    this.pings++;
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code: number, reason?: string): void {
    this.closed ??= { code, reason };
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Raw frames as sent (the legacy protocol is not v1 JSON with `t`). */
  get raw(): string[] {
    return this.sent.map((frame) => JSON.stringify(frame));
  }

  framesOf(t: string): Record<string, unknown>[] {
    return this.sent.filter((frame) => frame.t === t);
  }
}
