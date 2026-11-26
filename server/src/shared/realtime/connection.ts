// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { ConnectionContext, SessionInfo, VerifiedToken } from './options';
import {
  ClientFrame,
  ClientInfo,
  CloseCode,
  PROTOCOL_VERSIONS,
  decodeClientFrame,
  frames,
} from './protocol';
import type { HubInternals, RealtimeSocket } from './realtime-hub';
import { callWithTimeout } from './timeout';

export const HELLO_TIMEOUT_MS = 10_000;
export const HEARTBEAT_MS = 25_000;
export const IDLE_TIMEOUT_MS = 60_000;
export const MAX_AGE_MIN_MS = 50 * 60_000;
export const MAX_AGE_SPREAD_MS = 5 * 60_000;
export const MAX_BUFFERED_BYTES = 1_048_576;
export const MAX_QUEUED_FRAMES = 64;
// Repeated refreshTopics during the handshake must not keep it (and its slot) alive forever.
const MAX_HANDSHAKE_TOPIC_READS = 3;
// Client-chosen text; one connect line must not carry kilobytes of it.
const MAX_LOGGED_CLIENT_CHARS = 64;
// setTimeout overflows above 2^31-1 ms (~24.8 days).
const MAX_TIMER_MS = 2_147_483_647;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Claims that cannot be compared (BigInt, cycles) count as changed: re-reading topics is the safe side. */
function claimsDiffer(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(before) !== JSON.stringify(after);
  } catch {
    return true;
  }
}

type State = 'awaitingHello' | 'verifying' | 'ready' | 'closed';
type TimerName = 'hello' | 'idle' | 'expiry' | 'age' | 'ping' | 'pong';

// Old protocol (medvibe builds up to 1.0.7+44), byte for byte as the gateway it replaces.
const LEGACY_PING_MS = 30_000;
const LEGACY_PONG_TIMEOUT_MS = 10_000;
const LEGACY_EXPIRY_LEAD_S = 60;
const LEGACY_CLOSE_UNAUTHORIZED = 1008;
const LEGACY_CLOSE_TOKEN_EXPIRED = 4001;
const LEGACY_READY = '{"type":"ready"}';
const LEGACY_UNKNOWN_MESSAGE = '{"type":"error","code":4004,"message":"Unknown message type."}';
const LEGACY_MALFORMED = '{"type":"error","code":4004,"message":"Malformed JSON."}';
const LEGACY_TOKEN_EXPIRED = '{"type":"error","code":4001,"message":"Token expired. Reconnect with a fresh token."}';

/** One WebSocket session. Every async continuation re-checks `isClosed`. */
export class Connection {
  state: State = 'awaitingHello';
  readonly sid: string;
  userId = '';
  claims: Record<string, unknown> = {};
  client: ClientInfo = {};
  /** Topics the server assigned (`initialTopics`); the client cannot unsub them. */
  readonly assigned = new Set<string>();
  /** Topics the client subscribed to and was authorized for. */
  readonly subscribed = new Set<string>();
  /** Set by refreshTopics during the handshake; initialTopics is re-read before ready. */
  refreshRequested = false;
  private readonly openedAt: number;
  private readonly queue: ClientFrame[] = [];
  private readonly timers = new Map<TimerName, NodeJS.Timeout>();
  // Serializes sub/unsub/auth/refresh so an unsub cannot overtake the sub before it.
  private readonly tasks: { run: () => Promise<void>; isRefresh: boolean }[] = [];
  private draining = false;
  private refreshQueued = false;
  // Whether the task that ran last was a refresh; see requestRefresh.
  private lastWasRefresh = false;
  private pendingClientTasks = 0;
  private helloAt = 0;
  private expiresAt?: number;

  constructor(
    private readonly hub: HubInternals,
    readonly socket: RealtimeSocket,
    private readonly context: ConnectionContext,
    private readonly legacyToken?: string,
  ) {
    this.sid = `s_${hub.deps.newId()}`;
    this.openedAt = hub.deps.now();
  }

  /** Whether this session speaks the old medvibe protocol. */
  get isLegacy(): boolean {
    return this.legacyToken !== undefined;
  }

  /** Called by the hub once the connection is tracked, so an immediate close is accounted for. */
  start(): void {
    if (!this.isLegacy) {
      this.setTimer('hello', HELLO_TIMEOUT_MS, () => this.close(CloseCode.BadFrame, 'no hello'));
      return;
    }
    if (!this.legacyToken) return this.close(LEGACY_CLOSE_UNAUTHORIZED, 'Missing token');
    this.helloAt = this.hub.deps.now();
    this.state = 'verifying';
    this.beginAuthentication(0, this.legacyToken);
  }

  get isClosed(): boolean {
    return this.state === 'closed';
  }

  get info(): SessionInfo {
    return { sid: this.sid, userId: this.userId, claims: this.claims, client: this.client };
  }

  /** Every topic this session receives events for. */
  get topics(): Set<string> {
    return new Set([...this.assigned, ...this.subscribed]);
  }

  onMessage(raw: string): void {
    if (this.isClosed) return;
    if (this.isLegacy) return this.onLegacyMessage(raw);
    if (Buffer.byteLength(raw) > this.hub.options.limits.maxClientFrameBytes) {
      return this.close(CloseCode.BadFrame, 'frame too large');
    }
    const decoded = decodeClientFrame(raw);
    if (!decoded.ok) return this.close(CloseCode.BadFrame, decoded.reason);
    const frame = decoded.frame;
    switch (this.state) {
      case 'awaitingHello':
        return frame ? this.onHello(frame) : this.close(CloseCode.BadFrame, 'expected hello');
      case 'verifying':
        // No idle reset here: the handshake is bounded by the callback timeouts only.
        if (frame === null) return;
        if (this.queue.length >= MAX_QUEUED_FRAMES) {
          return this.close(CloseCode.TooMany, 'too many frames before ready');
        }
        this.queue.push(frame);
        return;
      case 'ready':
        this.resetIdle();
        if (frame !== null) this.handle(frame);
        return;
    }
  }

  /** The old gateway answered every client message with 4004 and kept the connection. */
  private onLegacyMessage(raw: string): void {
    if (this.state !== 'ready') return;
    try {
      JSON.parse(raw);
    } catch {
      return this.send(LEGACY_MALFORMED);
    }
    this.send(LEGACY_UNKNOWN_MESSAGE);
  }

  onPong(): void {
    this.clearTimer('pong');
  }

  /** Sends an event in this session's protocol. */
  deliver(frame: string, legacyFrame: () => string | null): void {
    if (!this.isLegacy) return this.send(frame);
    const encoded = legacyFrame();
    if (encoded !== null) this.send(encoded);
  }

  /** The transport reports the socket closed (by either side). */
  onClose(code?: number): void {
    if (this.isClosed) return;
    this.finish(code ?? 1006, 'client');
  }

  send(frame: string): void {
    if (this.isClosed) return;
    if (this.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      return this.close(CloseCode.TryAgainLater, 'slow consumer');
    }
    this.socket.send(frame);
  }

  close(code: number, reason: string): void {
    if (this.isClosed) return;
    this.finish(code, reason);
    this.socket.close(code, reason);
  }

  private finish(code: number, reason: string): void {
    const wasReady = this.state === 'ready';
    this.state = 'closed';
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.queue.length = 0;
    this.hub.unregister(this);
    const fields = {
      sid: this.sid,
      userId: this.userId || undefined,
      code,
      reason,
      durationMs: this.hub.deps.now() - this.openedAt,
    };
    if (wasReady) this.hub.options.logger.info('realtime.closed', fields);
    else this.hub.options.logger.warn('realtime.rejected', fields);
  }

  private onHello(frame: ClientFrame): void {
    if (frame.t !== 'hello') return this.close(CloseCode.BadFrame, 'expected hello');
    if (!PROTOCOL_VERSIONS.includes(frame.v)) {
      return this.close(CloseCode.UnsupportedVersion, 'unsupported version');
    }
    this.clearTimer('hello');
    this.helloAt = this.hub.deps.now();
    this.state = 'verifying';
    this.client = frame.client ?? {};
    this.beginAuthentication(frame.v, frame.token);
  }

  private beginAuthentication(version: number, token: string): void {
    this.authenticate(version, token).catch((error: unknown) => {
      this.hub.options.logger.error('realtime.handshake_failed', { sid: this.sid, error: errorText(error) });
      this.close(CloseCode.InternalError, 'internal error');
    });
  }

  private async authenticate(version: number, token: string): Promise<void> {
    const verified = await this.verify(token);
    if (this.isClosed || !verified) return;
    this.userId = verified.userId;
    this.claims = verified.claims ?? {};
    if (!this.applyExpiry(verified.expiresAt)) return;
    this.expiresAt = verified.expiresAt;
    if (this.hub.revokedSince(this.userId, this.helloAt)) {
      return this.close(CloseCode.Forbidden, 'session revoked');
    }
    // Reserve synchronously: concurrent hellos must not all pass the limit, and
    // refreshTopics/disconnectUser must see this session before it is ready.
    if (!this.hub.reserve(this)) {
      return this.close(CloseCode.TooMany, 'too many connections');
    }
    let assigned: string[] | null;
    let reads = 0;
    do {
      if (++reads > MAX_HANDSHAKE_TOPIC_READS) {
        return this.rejectHandshake(CloseCode.TryAgainLater, 'topics keep changing');
      }
      this.refreshRequested = false;
      assigned = await this.hub.assignedTopics(this);
      if (this.isClosed) return;
    } while (this.refreshRequested && assigned !== null);
    if (assigned === null) {
      // Failing closed with 1013 makes the client retry instead of looking connected with no topics.
      return this.rejectHandshake(CloseCode.TryAgainLater, 'initial topics unavailable');
    }
    for (const topic of assigned) this.assigned.add(topic);
    this.state = 'ready';
    this.hub.register(this);
    this.send(
      this.isLegacy
        ? LEGACY_READY
        : frames.ready({ v: version, sid: this.sid, hb: HEARTBEAT_MS, exp: verified.expiresAt, topics: [...this.assigned] }),
    );
    // send() closes a slow consumer; no timer may outlive the connection.
    if (this.isClosed) return;
    if (this.isLegacy) this.scheduleLegacyPing();
    else this.resetIdle();
    this.setTimer('age', MAX_AGE_MIN_MS + this.hub.deps.random() * MAX_AGE_SPREAD_MS, () =>
      this.close(CloseCode.Restart, 'connection age'),
    );
    this.hub.options.logger.info('realtime.connected', {
      sid: this.sid,
      userId: this.userId,
      app: this.client.app?.slice(0, MAX_LOGGED_CLIENT_CHARS),
      build: this.client.build,
      platform: this.client.platform?.slice(0, MAX_LOGGED_CLIENT_CHARS),
      topics: this.assigned.size,
      ...(this.isLegacy && { legacy: true }),
    });
    for (const queued of this.queue.splice(0)) this.handle(queued);
  }

  /** Returns null after closing with 4401 when the app rejects the token. */
  private async verify(token: string): Promise<VerifiedToken | null> {
    try {
      const verified = await callWithTimeout(
        () => this.hub.options.verifyToken(token, { ...this.context, client: this.client }),
        'verifyToken',
      );
      if (typeof verified?.userId !== 'string' || verified.userId === '') {
        throw new Error('verifyToken returned no userId');
      }
      return verified;
    } catch (error) {
      if (!this.isClosed) {
        this.hub.options.logger.warn('realtime.token_rejected', {
          sid: this.sid,
          error: errorText(error),
        });
        this.rejectHandshake(CloseCode.Unauthorized, 'token rejected');
      }
      return null;
    }
  }

  /** Old clients only know 1008 for a refused handshake; v1 clients get the precise code. */
  private rejectHandshake(code: number, reason: string): void {
    if (this.isLegacy && this.state !== 'ready') this.close(LEGACY_CLOSE_UNAUTHORIZED, 'Unauthorized');
    else this.close(code, reason);
  }

  /**
   * Schedules the 4401 close at expiry; false when the token has already expired.
   * Legacy sessions check expiry on their ping ticks instead, like the old gateway.
   */
  private applyExpiry(expiresAt: number | undefined): boolean {
    this.clearTimer('expiry');
    if (expiresAt === undefined) return true;
    const delay = expiresAt * 1000 - this.hub.deps.now();
    if (delay <= 0) {
      this.rejectHandshake(CloseCode.Unauthorized, 'token expired');
      return false;
    }
    if (this.isLegacy) return true;
    this.setTimer('expiry', delay, () => this.close(CloseCode.Unauthorized, 'token expired'));
    return true;
  }

  private handle(frame: ClientFrame): void {
    switch (frame.t) {
      case 'ping':
        return this.send(frames.pong());
      case 'hello':
        return this.close(CloseCode.BadFrame, 'second hello');
      case 'auth':
        return this.runClientTask(() => this.onAuth(frame.id, frame.token));
      case 'sub':
        return this.runClientTask(() => this.hub.subscribe(this, frame.id, frame.topics));
      case 'unsub':
        return this.runClientTask(async () => this.hub.unsubscribe(this, frame.id, frame.topics));
    }
  }

  /** Client frames waiting on the chain are capped like the pre-ready queue. */
  private runClientTask(task: () => Promise<void>): void {
    if (this.pendingClientTasks >= MAX_QUEUED_FRAMES) {
      return this.close(CloseCode.TooMany, 'too many pending frames');
    }
    this.pendingClientTasks++;
    this.runSerialized(async () => {
      try {
        await task();
      } finally {
        this.pendingClientTasks--;
      }
    });
  }

  /** Runs after every earlier sub/unsub/auth of this connection; skipped once closed. */
  runSerialized(task: () => Promise<void>): void {
    this.tasks.push({ run: task, isRefresh: false });
    void this.drain();
  }

  /**
   * Queues a topics refresh ahead of waiting client frames, so revoked access
   * is cut after at most the task already running, not after the whole queue.
   * A request while one is already queued adds nothing; one made while a
   * refresh is running queues a fresh read (access may have changed since).
   * Right after a refresh it waits behind one client frame, so a caller
   * hammering refreshTopics cannot starve sub/unsub/auth (which would stop
   * token renewal). Worst case for revoked access: the refresh already running
   * + one client frame + the refresh itself. A refresh reads the claims of the
   * last applied token (it can run before a queued `auth`); an `auth` that
   * changes claims queues its own refresh, which runs right after it.
   */
  requestRefresh(refresh: () => Promise<void>): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    const task = {
      isRefresh: true,
      run: async () => {
        this.refreshQueued = false;
        await refresh();
      },
    };
    this.tasks.splice(this.lastWasRefresh && this.tasks.length > 0 ? 1 : 0, 0, task);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (let task = this.tasks.shift(); task; task = this.tasks.shift()) {
        if (this.isClosed) break;
        this.lastWasRefresh = task.isRefresh;
        try {
          await task.run();
        } catch (error) {
          this.hub.options.logger.error('realtime.frame_failed', { sid: this.sid, error: errorText(error) });
        }
      }
    } finally {
      this.tasks.length = 0;
      this.draining = false;
    }
  }

  private async onAuth(id: number, token: string): Promise<void> {
    const verified = await this.verify(token);
    if (this.isClosed || !verified) return;
    // 4401, not 4403: the client fetches a fresh token and sends a new hello,
    // which is exactly right for logout/login on the same device; 4403 would stop it.
    if (verified.userId !== this.userId) {
      return this.close(CloseCode.Unauthorized, 'token for another user');
    }
    const claimsChanged = claimsDiffer(this.claims, verified.claims ?? {});
    this.claims = verified.claims ?? {};
    if (!this.applyExpiry(verified.expiresAt)) return;
    this.send(frames.ack({ id, exp: verified.expiresAt }));
    // Rights may depend on claims (a role change): re-read topics and re-check subscriptions.
    if (claimsChanged) this.requestRefresh(() => this.hub.refresh(this));
  }

  private scheduleLegacyPing(): void {
    this.setTimer('ping', LEGACY_PING_MS, () => this.legacyPingTick());
  }

  private legacyPingTick(): void {
    const nowS = this.hub.deps.now() / 1000;
    if (this.expiresAt !== undefined && nowS >= this.expiresAt - LEGACY_EXPIRY_LEAD_S) {
      this.send(LEGACY_TOKEN_EXPIRED);
      return this.close(LEGACY_CLOSE_TOKEN_EXPIRED, '');
    }
    this.socket.ping?.();
    this.setTimer('pong', LEGACY_PONG_TIMEOUT_MS, () => this.close(CloseCode.GoingAway, 'Pong timeout'));
    this.scheduleLegacyPing();
  }

  private resetIdle(): void {
    this.setTimer('idle', IDLE_TIMEOUT_MS, () => this.close(CloseCode.GoingAway, 'idle'));
  }

  private setTimer(name: TimerName, delayMs: number, run: () => void): void {
    this.clearTimer(name);
    this.timers.set(name, setTimeout(run, Math.min(delayMs, MAX_TIMER_MS)));
  }

  private clearTimer(name: TimerName): void {
    const timer = this.timers.get(name);
    if (timer) clearTimeout(timer);
    this.timers.delete(name);
  }
}
