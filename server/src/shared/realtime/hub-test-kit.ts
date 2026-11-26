// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { HubDeps, RealtimeHub } from './realtime-hub';
import { RealtimeOptions, VerifiedToken, resolveOptions } from './options';
import { FakeSocket } from './testing';

export const NOW_MS = Date.UTC(2026, 10, 20, 0, 0, 0);
export const NOW_S = NOW_MS / 1000;

/** Token format in unit tests: `<userId>` or `<userId>@<expiresAt seconds>`. */
export async function fakeVerify(token: string): Promise<VerifiedToken> {
  if (token === 'bad') throw new Error('invalid token');
  const [userId, exp] = token.split('@');
  return { userId, ...(exp && { expiresAt: Number(exp) }) };
}

export function makeHub(
  options: Partial<RealtimeOptions> = {},
  deps: HubDeps = {},
) {
  let counter = 0;
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const resolved = resolveOptions({
    path: '/ws',
    verifyToken: fakeVerify,
    logger,
    ...options,
  });
  const hub = new RealtimeHub(resolved, {
    newId: () => `id${++counter}`,
    random: () => 0,
    instanceId: 'test',
    ...deps,
  });
  const connect = () => {
    const socket = new FakeSocket();
    const handle = hub.accept(socket, { ip: '127.0.0.1' });
    const send = (frame: object) => handle.onMessage(JSON.stringify(frame));
    return { socket, handle, send };
  };
  /** An old medvibe client: token in the URL, never sends hello. */
  const connectLegacy = async (token: string) => {
    const socket = new FakeSocket();
    const handle = hub.accept(socket, { ip: '127.0.0.1' }, token);
    await jest.advanceTimersByTimeAsync(0);
    return { socket, handle, send: (raw: string) => handle.onMessage(raw) };
  };
  /** Connects and completes the hello → ready handshake. */
  const connectReady = async (token = 'u1') => {
    const client = connect();
    client.send({ t: 'hello', v: 1, token });
    await jest.advanceTimersByTimeAsync(0);
    return client;
  };
  return { hub, connect, connectReady, connectLegacy, logger, options: resolved };
}

export const flush = () => jest.advanceTimersByTimeAsync(0);
