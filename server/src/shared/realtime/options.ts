// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { BroadcastAdapter, InProcessBroadcastAdapter } from './broadcast-adapter';
import { ClientInfo } from './protocol';

/**
 * REST header in which the app sends `ready.sid`. Its value is untrusted client input:
 * pass it as `publish(..., { exceptSession: { sid, userId } })` together with the
 * authenticated user's id, so a sid of someone else's session cannot suppress that event.
 */
export const REALTIME_SESSION_HEADER = 'x-realtime-session';

export interface VerifiedToken {
  userId: string;
  /** Unix seconds; the connection closes with 4401 at this moment unless `auth` extends it. */
  expiresAt?: number;
  claims?: Record<string, unknown>;
}

export interface SessionInfo {
  sid: string;
  userId: string;
  claims: Record<string, unknown>;
  client: ClientInfo;
}

export interface ConnectionContext {
  origin?: string;
  ip?: string;
}

export interface RealtimeLogger {
  info(message: string, fields?: object): void;
  warn(message: string, fields?: object): void;
  error(message: string, fields?: object): void;
}

export interface RealtimeLimits {
  maxConnectionsPerUser: number;
  maxTopicsPerSession: number;
  maxClientFrameBytes: number;
  maxEventBytes: number;
}

/** An event as the legacy encoder receives it. */
export interface LegacyEvent {
  topic: string;
  type: string;
  data: unknown;
}

/**
 * Old medvibe protocol (builds up to 1.0.7+44): token in the URL query, server
 * pings, `{"type":"ready"}`. Enabled only where such clients still exist.
 */
export interface RealtimeLegacyOptions {
  /** A request carrying this query parameter speaks the old protocol. */
  queryTokenParam: string;
  /** Shapes an event for old clients; the result is sent as JSON. Return `undefined` to send nothing. */
  encode(event: LegacyEvent): unknown;
}

export interface RealtimeOptions {
  /** URL path that accepts WebSocket upgrades, e.g. `/ws`. */
  path: string;
  /** Throws → close 4401. */
  verifyToken(
    token: string,
    context: ConnectionContext & { client: ClientInfo },
  ): Promise<VerifiedToken>;
  /** Topics the server assigns by itself (medvibe model). */
  initialTopics?(session: SessionInfo): Promise<string[]>;
  /** Permission for a client-requested topic. Missing, false or throwing → denied. */
  authorizeSubscribe?(session: SessionInfo, topic: string): Promise<boolean>;
  adapter?: BroadcastAdapter;
  /** Browser origins allowed to connect; requests without `Origin` (native apps) always pass. */
  allowedOrigins?: string[];
  limits?: Partial<RealtimeLimits>;
  logger?: RealtimeLogger;
  legacy?: RealtimeLegacyOptions;
  /**
   * How many proxies in front of the server append to `X-Forwarded-For`
   * (default 1). The client IP given to `verifyToken` is the entry that many
   * places from the right; entries further left are written by the client and
   * can be forged. The IP is trustworthy only when this equals the real number
   * of proxies and the service cannot be reached around them; set 0 when
   * clients connect directly (then the header is ignored and the socket address is used).
   */
  trustedProxyHops?: number;
}

export interface ResolvedRealtimeOptions
  extends Omit<RealtimeOptions, 'adapter' | 'limits' | 'logger' | 'trustedProxyHops'> {
  adapter: BroadcastAdapter;
  limits: RealtimeLimits;
  logger: RealtimeLogger;
  trustedProxyHops: number;
}

export const DEFAULT_LIMITS: RealtimeLimits = {
  // Generous on purpose: a flapping phone leaves dead sockets until the 60 s
  // idle timeout, and they must not lock the user out.
  maxConnectionsPerUser: 10,
  maxTopicsPerSession: 50,
  maxClientFrameBytes: 16_384,
  maxEventBytes: 65_536,
};

const silentLogger: RealtimeLogger = { info() {}, warn() {}, error() {} };

export function resolveOptions(options: RealtimeOptions): ResolvedRealtimeOptions {
  if (options.legacy && (!options.legacy.queryTokenParam || typeof options.legacy.encode !== 'function')) {
    throw new Error('realtime: legacy needs a non-empty queryTokenParam and an encode function');
  }
  if (options.trustedProxyHops !== undefined && !(Number.isInteger(options.trustedProxyHops) && options.trustedProxyHops >= 0)) {
    throw new Error('realtime: trustedProxyHops must be a non-negative integer');
  }
  if (!options.path.startsWith('/')) {
    throw new Error(`realtime: path must start with "/", got "${options.path}"`);
  }
  const logger = options.logger ? safeLogger(options.logger) : silentLogger;
  return {
    ...options,
    adapter: options.adapter ?? new InProcessBroadcastAdapter(logger),
    limits: { ...DEFAULT_LIMITS, ...options.limits },
    logger,
    trustedProxyHops: options.trustedProxyHops ?? 1,
  };
}

/** A failing logger must never break a connection or a publish. */
function safeLogger(logger: RealtimeLogger): RealtimeLogger {
  const guard =
    (log: (message: string, fields?: object) => void) =>
    (message: string, fields?: object) => {
      try {
        log.call(logger, message, fields);
      } catch {
        // Nothing sensible to do when logging itself fails.
      }
    };
  return { info: guard(logger.info), warn: guard(logger.warn), error: guard(logger.error) };
}
