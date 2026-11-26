// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import type { IncomingMessage, Server } from 'node:http';
import { isIP } from 'node:net';
import type { Duplex } from 'node:stream';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { ResolvedRealtimeOptions } from './options';
import { RealtimeHub } from './realtime-hub';

const FORBIDDEN_RESPONSE =
  'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n';

/** The address `hops` entries from the right of X-Forwarded-For; the socket address if there are not enough. */
function clientIp(request: IncomingMessage, hops: number): string | undefined {
  const header = request.headers['x-forwarded-for'];
  const entries = (Array.isArray(header) ? header.join(',') : (header ?? ''))
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const forwarded = hops > 0 && entries.length >= hops ? normalizeIp(entries[entries.length - hops]) : undefined;
  return forwarded || request.socket.remoteAddress;
}

/** A bare IP from a forwarded entry (`1.2.3.4:80`, `[::1]:443`), or undefined if it is not an IP. */
function normalizeIp(entry: string): string | undefined {
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(entry);
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(entry);
  const candidate = bracketed?.[1] ?? withPort?.[1] ?? entry;
  return isIP(candidate) === 0 ? undefined : candidate;
}

/** Path part of a request target without URL parsing, which throws on targets like `//`. */
const requestPath = (target: string | undefined): string => (target ?? '/').split('?')[0];

const toText = (data: RawData): string =>
  Array.isArray(data) ? Buffer.concat(data).toString('utf8') : Buffer.from(data as Buffer).toString('utf8');

/**
 * Serves WebSocket upgrades on `options.path` of an existing HTTP server
 * (`ws` in noServer mode, no `@WebSocketGateway`). Returns a detach function.
 */
export function attachRealtime(
  server: Server,
  hub: RealtimeHub,
  options: ResolvedRealtimeOptions,
): () => void {
  // Hard stop for absurd frames; the hub enforces the real limit with 4400.
  const wss = new WebSocketServer({ noServer: true, maxPayload: options.limits.maxClientFrameBytes * 4 });

  const accept = (ws: WebSocket, request: IncomingMessage) => {
    const handle = hub.accept(ws, { origin: request.headers.origin, ip: clientIp(request, options.trustedProxyHops) }, legacyToken(request.url));
    ws.on('message', (data, isBinary) => {
      // A throw here would be an uncaught exception in ws and take the process down.
      try {
        handle.onMessage(isBinary ? '' : toText(data), isBinary);
      } catch (error) {
        options.logger.error('realtime.message_failed', { error: error instanceof Error ? error.message : String(error) });
        ws.close(1011, 'internal error');
      }
    });
    ws.on('close', (code) => handle.onClose(code));
    ws.on('pong', () => handle.onPong?.());
    ws.on('error', (error) => options.logger.warn('realtime.socket_error', { error: error.message }));
  };

  /** The token from the URL when legacy mode is on and the request carries it (possibly empty). */
  const legacyToken = (target: string | undefined): string | undefined => {
    if (!options.legacy) return undefined;
    const query = (target ?? '').split('?')[1];
    const params = new URLSearchParams(query ?? '');
    return params.has(options.legacy.queryTokenParam) ? (params.get(options.legacy.queryTokenParam) ?? '') : undefined;
  };

  const route = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (requestPath(request.url) !== options.path) {
      // Another upgrade handler may own this path; with none, the socket would hang.
      if (server.listenerCount('upgrade') === 1) socket.destroy();
      return;
    }
    const origin = request.headers.origin;
    if (origin && options.allowedOrigins && !options.allowedOrigins.includes(origin)) {
      options.logger.warn('realtime.origin_rejected', { origin: origin.slice(0, 200) });
      socket.end(FORBIDDEN_RESPONSE, () => socket.destroy());
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => accept(ws, request));
  };

  // Runs before any authentication: nothing a client sends here may throw out of
  // the listener, or the whole process (REST included) goes down.
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    // Node drops its own error listener from upgraded sockets; a client reset
    // would otherwise be an uncaught EPIPE/ECONNRESET.
    socket.on('error', () => socket.destroy());
    try {
      route(request, socket, head);
    } catch (error) {
      options.logger.warn('realtime.upgrade_failed', { error: error instanceof Error ? error.message : String(error) });
      socket.destroy();
    }
  };

  server.on('upgrade', onUpgrade);
  return () => {
    server.off('upgrade', onUpgrade);
    wss.close();
  };
}
