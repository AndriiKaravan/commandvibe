// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
/** Realtime protocol v1: frame types, decoding of client frames, encoding of server frames. */

export const PROTOCOL_VERSIONS: readonly number[] = [1];

/** Every client → server frame type the server understands; anything else is ignored after hello. */
export const CLIENT_FRAME_TYPES = ['hello', 'sub', 'unsub', 'auth', 'ping'] as const;

export const CloseCode = {
  Normal: 1000,
  GoingAway: 1001,
  Restart: 1012,
  InternalError: 1011,
  TryAgainLater: 1013,
  BadFrame: 4400,
  Unauthorized: 4401,
  Forbidden: 4403,
  UnsupportedVersion: 4426,
  TooMany: 4429,
} as const;

export interface ClientInfo {
  app?: string;
  build?: number;
  platform?: string;
}

export type ClientFrame =
  | { t: 'hello'; v: number; token: string; client?: ClientInfo }
  | { t: 'sub' | 'unsub'; id: number; topics: string[] }
  | { t: 'auth'; id: number; token: string }
  | { t: 'ping' };

/** `frame: null` means an unknown `t`: the caller ignores it. */
export type DecodeResult =
  | { ok: true; frame: ClientFrame | null }
  | { ok: false; reason: string };

export type DenyReason = 'forbidden' | 'invalid' | 'limit' | 'assigned';

export interface Denied {
  topic: string;
  reason: DenyReason;
}

const MAX_TOPIC_LENGTH = 128;
const TOPIC_PATTERN = /^[a-z][a-z0-9_-]*:\S+$/;

export function isValidTopic(topic: unknown): topic is string {
  return (
    typeof topic === 'string' &&
    topic.length <= MAX_TOPIC_LENGTH &&
    TOPIC_PATTERN.test(topic)
  );
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (reason: string): DecodeResult => ({ ok: false, reason });

function decodeClientInfo(value: unknown): ClientInfo | undefined {
  if (!isObject(value)) return undefined;
  const info: ClientInfo = {};
  if (typeof value.app === 'string') info.app = value.app;
  if (Number.isInteger(value.build)) info.build = value.build as number;
  if (typeof value.platform === 'string') info.platform = value.platform;
  return info;
}

function decodeTopicsFrame(t: 'sub' | 'unsub', json: Json): DecodeResult {
  const { id, topics } = json;
  if (!Number.isInteger(id)) return fail(`${t}: id must be an integer`);
  if (!Array.isArray(topics) || !topics.every((x) => typeof x === 'string')) {
    return fail(`${t}: topics must be an array of strings`);
  }
  return { ok: true, frame: { t, id: id as number, topics: [...topics] } };
}

function decodeKnown(json: Json): DecodeResult {
  switch (json.t) {
    case 'hello': {
      if (!Number.isInteger(json.v)) return fail('hello: v must be an integer');
      if (typeof json.token !== 'string') return fail('hello: token must be a string');
      const client = decodeClientInfo(json.client);
      return {
        ok: true,
        frame: { t: 'hello', v: json.v as number, token: json.token, ...(client && { client }) },
      };
    }
    case 'sub':
    case 'unsub':
      return decodeTopicsFrame(json.t, json);
    case 'auth':
      if (!Number.isInteger(json.id)) return fail('auth: id must be an integer');
      if (typeof json.token !== 'string') return fail('auth: token must be a string');
      return { ok: true, frame: { t: 'auth', id: json.id as number, token: json.token } };
    case 'ping':
      return { ok: true, frame: { t: 'ping' } };
    default:
      return { ok: true, frame: null };
  }
}

/** Decodes one text frame; the result never shares objects with the input. */
export function decodeClientFrame(raw: string): DecodeResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail('not JSON');
  }
  if (!isObject(json)) return fail('not a JSON object');
  if (typeof json.t !== 'string') return fail('missing t');
  return decodeKnown(json);
}

const nonEmpty = <T>(list: T[] | undefined): T[] | undefined =>
  list && list.length > 0 ? list : undefined;

/** Server → client frame encoders. Optional fields are omitted, never `null`. */
export const frames = {
  ready: (a: { v: number; sid: string; hb: number; exp?: number; topics: string[] }): string =>
    JSON.stringify({ t: 'ready', v: a.v, sid: a.sid, hb: a.hb, exp: a.exp, topics: a.topics }),
  ack: (a: { id: number; ok?: string[]; denied?: Denied[]; exp?: number }): string =>
    JSON.stringify({ t: 'ack', id: a.id, ok: nonEmpty(a.ok), denied: nonEmpty(a.denied), exp: a.exp }),
  event: (a: { topic: string; type: string; data: unknown; id: string; ts: number }): string =>
    JSON.stringify({ t: 'event', topic: a.topic, type: a.type, data: a.data ?? null, id: a.id, ts: a.ts }),
  topics: (a: { add: string[]; remove: string[] }): string =>
    JSON.stringify({ t: 'topics', add: a.add, remove: a.remove }),
  pong: (): string => '{"t":"pong"}',
};
