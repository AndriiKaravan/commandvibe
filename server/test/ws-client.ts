import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'node:net';
import WebSocket from 'ws';

type Frame = Record<string, unknown> & { t: string };

/** Minimal protocol v1 client for e2e tests. */
export class TestSocket {
  readonly frames: Frame[] = [];
  closeCode?: number;
  private readonly socket: WebSocket;
  private nextId = 1;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on('message', (raw) => this.frames.push(JSON.parse(raw.toString()) as Frame));
    socket.on('close', (code) => (this.closeCode = code));
  }

  static async connect(app: INestApplication, token: string): Promise<TestSocket> {
    const { port } = (app.getHttpServer().address() as AddressInfo);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const client = new TestSocket(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });
    socket.send(JSON.stringify({ t: 'hello', v: 1, token, client: { app: 'e2e' } }));
    return client;
  }

  subscribe(topic: string): number {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ t: 'sub', id, topics: [topic] }));
    return id;
  }

  async next(predicate: (frame: Frame) => boolean, timeoutMs = 3000): Promise<Frame> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = this.frames.find(predicate);
      if (found) {
        return found;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`no matching frame; got ${JSON.stringify(this.frames)}`);
  }

  async closed(timeoutMs = 3000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    while (this.closeCode === undefined && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (this.closeCode === undefined) {
      throw new Error('socket still open');
    }
    return this.closeCode;
  }

  close(): void {
    this.socket.close();
  }
}
