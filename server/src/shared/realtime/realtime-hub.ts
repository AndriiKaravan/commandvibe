// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { randomBytes } from 'node:crypto';
import { BroadcastMessage } from './broadcast-adapter';
import { Connection } from './connection';
import { ConnectionContext, ResolvedRealtimeOptions } from './options';
import { CloseCode, Denied, frames, isValidTopic } from './protocol';
import { TopicIndex } from './topic-index';
import { callWithTimeout } from './timeout';

export const SHUTDOWN_GRACE_MS = 2_000;
// Longer than any handshake can take (hello 10 s + verifyToken 10 s).
const REVOCATION_MEMORY_MS = 30_000;

/** The part of a `ws` WebSocket the hub needs; unit tests pass a fake. */
export interface RealtimeSocket {
  send(data: string): void;
  close(code: number, reason?: string): void;
  terminate(): void;
  /** Protocol-level ping; only legacy connections use it. */
  ping?(): void;
  readonly bufferedAmount: number;
}

/** What the transport calls for one accepted socket. */
export interface ConnectionHandle {
  /** Binary frames are not part of the protocol and close the connection with 4400. */
  onMessage(raw: string, isBinary?: boolean): void;
  onClose(code?: number): void;
  /** Protocol-level pong from the client (legacy heartbeat). */
  onPong?(): void;
}

export interface HubDeps {
  now?: () => number;
  random?: () => number;
  newId?: () => string;
  instanceId?: string;
}

/** Hub surface used by `Connection`; not part of the public API. */
export interface HubInternals {
  readonly options: ResolvedRealtimeOptions;
  readonly deps: Required<HubDeps>;
  register(connection: Connection): void;
  unregister(connection: Connection): void;
  reserve(connection: Connection): boolean;
  revokedSince(userId: string, since: number): boolean;
  assignedTopics(connection: Connection): Promise<string[] | null>;
  subscribe(connection: Connection, id: number, topics: string[]): Promise<void>;
  unsubscribe(connection: Connection, id: number, topics: string[]): void;
  refresh(connection: Connection): Promise<void>;
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Framework-free core: sessions, topics, publishing. One per process. */
export class RealtimeHub implements HubInternals {
  readonly deps: Required<HubDeps>;
  private readonly open = new Set<Connection>();
  private readonly byUser = new Map<string, Set<Connection>>();
  private readonly index = new TopicIndex<Connection>();
  private shuttingDown = false;
  private shutdownPromise?: Promise<void>;
  /** userId → when disconnectUser last ran; catches sessions still inside verifyToken. */
  private readonly revokedAt = new Map<string, number>();
  // Sockets told to close on shutdown whose transport has not confirmed it yet.
  private readonly unclosedSockets = new Set<RealtimeSocket>();
  // Every socket handed to accept() until the transport confirms it closed, so
  // shutdown also reaches sockets whose connection closed earlier (for example 1013).
  private readonly liveSockets = new Set<RealtimeSocket>();
  private allSocketsClosed?: () => void;

  constructor(
    readonly options: ResolvedRealtimeOptions,
    deps: HubDeps = {},
  ) {
    this.deps = {
      now: deps.now ?? Date.now,
      random: deps.random ?? Math.random,
      newId: deps.newId ?? (() => randomBytes(8).toString('hex')),
      instanceId: deps.instanceId ?? randomBytes(8).toString('hex'),
    };
    options.adapter.subscribe((message) => this.onBroadcast(message));
  }

  /** `legacyToken` set (even empty) means the old protocol: the token came in the URL. */
  accept(socket: RealtimeSocket, context: ConnectionContext, legacyToken?: string): ConnectionHandle {
    if (this.shuttingDown) {
      socket.close(CloseCode.Restart, 'shutting down');
      this.unclosedSockets.add(socket);
      return { onMessage() {}, onClose: () => this.socketClosed(socket) };
    }
    this.liveSockets.add(socket);
    const connection = new Connection(this, socket, context, legacyToken);
    this.open.add(connection);
    connection.start();
    return {
      onMessage: (raw, isBinary) =>
        isBinary ? connection.close(CloseCode.BadFrame, 'binary frame') : connection.onMessage(raw),
      onClose: (code) => {
        connection.onClose(code);
        this.liveSockets.delete(socket);
        this.socketClosed(socket);
      },
      onPong: () => connection.onPong(),
    };
  }

  stats(): { connections: number; topics: number } {
    return { connections: this.open.size, topics: this.index.topicCount };
  }

  /** Closes every connection with 1012, then terminates whatever is still open after the grace period. */
  shutdown(): Promise<void> {
    // A second call waits for the first instead of returning while sockets are still closing.
    this.shutdownPromise ??= this.doShutdown();
    return this.shutdownPromise;
  }

  private async doShutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const socket of this.liveSockets) this.unclosedSockets.add(socket);
    for (const connection of [...this.open]) {
      connection.close(CloseCode.Restart, 'server shutdown');
    }
    if (this.unclosedSockets.size > 0) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        new Promise<void>((resolve) => (this.allSocketsClosed = resolve)),
        new Promise<void>((resolve) => (timer = setTimeout(resolve, SHUTDOWN_GRACE_MS))),
      ]);
      clearTimeout(timer);
      for (const socket of this.unclosedSockets) socket.terminate();
    }
    await this.options.adapter.close();
  }

  private socketClosed(socket: RealtimeSocket): void {
    if (!this.unclosedSockets.delete(socket)) return;
    if (this.unclosedSockets.size === 0) this.allSocketsClosed?.();
  }

  /** Counts the connection against its user's limit; false when the user is at the limit. */
  reserve(connection: Connection): boolean {
    let sessions = this.byUser.get(connection.userId);
    if (!sessions) {
      sessions = new Set();
      this.byUser.set(connection.userId, sessions);
    }
    if (sessions.size >= this.options.limits.maxConnectionsPerUser) return false;
    sessions.add(connection);
    return true;
  }

  revokedSince(userId: string, since: number): boolean {
    const at = this.revokedAt.get(userId);
    return at !== undefined && at >= since;
  }

  private rememberRevocation(userId: string): void {
    const now = this.deps.now();
    for (const [user, at] of this.revokedAt) {
      if (now - at > REVOCATION_MEMORY_MS) this.revokedAt.delete(user);
    }
    this.revokedAt.set(userId, now);
  }

  register(connection: Connection): void {
    for (const topic of connection.topics) this.index.add(topic, connection);
  }

  unregister(connection: Connection): void {
    this.open.delete(connection);
    this.index.removeAll(connection, connection.topics);
    const sessions = this.byUser.get(connection.userId);
    if (!sessions) return;
    sessions.delete(connection);
    if (sessions.size === 0) this.byUser.delete(connection.userId);
  }

  /** Assigned topics from the app; null when initialTopics failed or timed out. */
  async assignedTopics(connection: Connection): Promise<string[] | null> {
    const { initialTopics } = this.options;
    if (!initialTopics) return [];
    try {
      const topics = await callWithTimeout(() => initialTopics(connection.info), 'initialTopics');
      const invalid = topics.filter((topic) => !isValidTopic(topic));
      if (invalid.length > 0) {
        this.options.logger.error('realtime.invalid_assigned_topics', {
          sid: connection.sid,
          count: invalid.length,
        });
      }
      return topics.filter(isValidTopic);
    } catch (error) {
      this.options.logger.error('realtime.initial_topics_failed', {
        sid: connection.sid,
        error: errorText(error),
      });
      return null;
    }
  }

  publish(
    topic: string,
    type: string,
    data: unknown,
    opts: { exceptUserId?: string; exceptSession?: { sid: string; userId: string } } = {},
  ): void {
    const { logger, limits } = this.options;
    if (!isValidTopic(topic)) {
      return logger.error('realtime.invalid_topic', { topic: String(topic).slice(0, 140), type });
    }
    let frame: string;
    try {
      frame = frames.event({ topic, type, data, id: `e_${this.deps.newId()}`, ts: this.deps.now() });
    } catch (error) {
      return logger.error('realtime.event_not_serializable', { topic, type, error: errorText(error) });
    }
    const bytes = Buffer.byteLength(frame);
    if (bytes > limits.maxEventBytes) {
      return logger.error('realtime.event_too_large', { topic, type, bytes });
    }
    // A malformed exclusion delivers to everyone: suppressing an event is the worse failure.
    const { exceptUserId, exceptSession: requested } = opts ?? {};
    let exceptSession: { sid: string; userId: string } | undefined;
    if (requested !== undefined) {
      const { sid, userId } = requested ?? {};
      if (typeof sid === 'string' && sid !== '' && typeof userId === 'string' && userId !== '') {
        exceptSession = { sid, userId };
      } else {
        logger.error('realtime.invalid_except_session', { topic, type });
      }
    }
    this.broadcast({ kind: 'event', origin: this.deps.instanceId, topic, frame, exceptUserId, exceptSession });
  }

  /** Revokes the user's sessions on every instance (4403). */
  disconnectUser(userId: string): void {
    this.broadcast({ kind: 'disconnectUser', origin: this.deps.instanceId, userId });
  }

  /** Recomputes assigned topics and subscription rights of the user's sessions on every instance. */
  refreshTopics(userId: string): void {
    this.broadcast({ kind: 'refreshTopics', origin: this.deps.instanceId, userId });
  }

  async subscribe(connection: Connection, id: number, topics: string[]): Promise<void> {
    const ok: string[] = [];
    const denied: Denied[] = [];
    const candidates: string[] = [];
    for (const topic of new Set(topics)) {
      if (!isValidTopic(topic)) denied.push({ topic, reason: 'invalid' });
      else if (connection.subscribed.has(topic)) ok.push(topic);
      else if (connection.assigned.has(topic)) {
        // Already granted by the server, so always ok. Recorded as the client's own
        // subscription (it survives losing the assignment; refresh re-authorizes it)
        // only while there is room: the limit is never exceeded through this path.
        if (connection.subscribed.size < this.options.limits.maxTopicsPerSession) connection.subscribed.add(topic);
        ok.push(topic);
      } else candidates.push(topic);
    }
    // The limit gates authorization: one frame must not fan out into thousands of app calls.
    const free = Math.max(0, this.options.limits.maxTopicsPerSession - connection.subscribed.size);
    for (const topic of candidates.splice(free)) denied.push({ topic, reason: 'limit' });
    const allowed = await Promise.all(candidates.map((topic) => this.authorize(connection, topic)));
    if (connection.isClosed) return;
    candidates.forEach((topic, i) => {
      if (!allowed[i]) return denied.push({ topic, reason: 'forbidden' });
      if (connection.subscribed.size >= this.options.limits.maxTopicsPerSession) {
        return denied.push({ topic, reason: 'limit' });
      }
      connection.subscribed.add(topic);
      this.index.add(topic, connection);
      ok.push(topic);
    });
    connection.send(frames.ack({ id, ok, denied }));
  }

  unsubscribe(connection: Connection, id: number, topics: string[]): void {
    const ok: string[] = [];
    const denied: Denied[] = [];
    for (const topic of new Set(topics)) {
      if (!isValidTopic(topic)) {
        denied.push({ topic, reason: 'invalid' });
      } else if (connection.assigned.has(topic)) {
        connection.subscribed.delete(topic);
        denied.push({ topic, reason: 'assigned' });
      } else if (connection.subscribed.delete(topic)) {
        this.index.remove(topic, connection);
        ok.push(topic);
      } else {
        ok.push(topic);
      }
    }
    connection.send(frames.ack({ id, ok, denied }));
  }

  /** Deny by default: a missing, false-returning or throwing callback refuses the topic. */
  private async authorize(connection: Connection, topic: string): Promise<boolean> {
    const { authorizeSubscribe, logger } = this.options;
    if (!authorizeSubscribe) return false;
    try {
      return (await callWithTimeout(() => authorizeSubscribe(connection.info, topic), 'authorizeSubscribe')) === true;
    } catch (error) {
      logger.error('realtime.authorize_failed', { sid: connection.sid, topic, error: errorText(error) });
      return false;
    }
  }

  private broadcast(message: BroadcastMessage): void {
    const onError = (error: unknown) =>
      this.options.logger.error('realtime.adapter_failed', { kind: message.kind, error: errorText(error) });
    try {
      this.options.adapter.publish(message).catch(onError);
    } catch (error) {
      onError(error);
    }
  }

  private onBroadcast(message: BroadcastMessage): void {
    switch (message.kind) {
      case 'event':
      {
        // Encoded at most once per publish, and only if a legacy session gets it.
        let legacyFrame: string | null | undefined;
        const legacyOf = () => (legacyFrame === undefined ? (legacyFrame = this.encodeLegacy(message)) : legacyFrame);
        // Copy: a send may close a slow consumer, which mutates the index.
        for (const connection of [...this.index.get(message.topic)]) {
          if (connection.userId === message.exceptUserId) continue;
          // Both must match: the sid comes from a client header, the userId from the caller's auth.
          if (connection.sid === message.exceptSession?.sid && connection.userId === message.exceptSession.userId) continue;
          // One broken socket must not stop delivery to the rest.
          try {
            connection.deliver(message.frame, legacyOf);
          } catch (error) {
            this.options.logger.error('realtime.send_failed', { sid: connection.sid, error: errorText(error) });
          }
        }
        return;
      }
      case 'disconnectUser':
        this.rememberRevocation(message.userId);
        for (const connection of [...(this.byUser.get(message.userId) ?? [])]) {
          connection.close(CloseCode.Forbidden, 'session revoked');
        }
        return;
      case 'refreshTopics':
        for (const connection of this.byUser.get(message.userId) ?? []) {
          if (connection.state === 'ready') connection.requestRefresh(() => this.refresh(connection));
          else connection.refreshRequested = true;
        }
        return;
    }
  }

  /** The legacy JSON for an event frame; null (and an error log) if the app's encoder fails. */
  private encodeLegacy(message: Extract<BroadcastMessage, { kind: 'event' }>): string | null {
    const { legacy, logger } = this.options;
    if (!legacy) return null;
    try {
      const { topic, type, data } = JSON.parse(message.frame) as { topic: string; type: string; data: unknown };
      // undefined from encode() means "not for old clients"; JSON.stringify would pass it through.
      const encoded = JSON.stringify(legacy.encode({ topic, type, data }));
      return typeof encoded === 'string' ? encoded : null;
    } catch (error) {
      logger.error('realtime.legacy_encode_failed', { topic: message.topic, error: errorText(error) });
      return null;
    }
  }

  async refresh(connection: Connection): Promise<void> {
    const subscribed = [...connection.subscribed];
    const [assigned, allowed] = await Promise.all([
      this.assignedTopics(connection),
      Promise.all(subscribed.map((topic) => this.authorize(connection, topic))),
    ]);
    if (connection.isClosed) return;
    // Fail closed: keeping the old assignment could keep a revoked topic flowing
    // for up to an hour; 1013 makes the client reconnect and re-read.
    if (assigned === null) return connection.close(CloseCode.TryAgainLater, 'topics unavailable');
    const before = connection.topics;
    connection.assigned.clear();
    for (const topic of assigned) connection.assigned.add(topic);
    subscribed.forEach((topic, i) => {
      if (!allowed[i]) connection.subscribed.delete(topic);
    });
    const after = connection.topics;
    const add = [...after].filter((topic) => !before.has(topic));
    const remove = [...before].filter((topic) => !after.has(topic));
    for (const topic of add) this.index.add(topic, connection);
    for (const topic of remove) this.index.remove(topic, connection);
    // Old clients have no `topics` frame; their delivery just follows the index.
    if ((add.length > 0 || remove.length > 0) && !connection.isLegacy) {
      connection.send(frames.topics({ add, remove }));
    }
  }
}
