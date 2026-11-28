// generated from ks_server/push — do not edit; run: npm run sync:push
export const PUSH_PLATFORMS = ['android', 'ios', 'web'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** Longest FCM token the API accepts; real ones are ~160–200 characters. */
export const MAX_PUSH_TOKEN_LENGTH = 4096;

/** Default number of devices an account keeps; older tokens are dropped. */
export const DEFAULT_MAX_TOKENS_PER_USER = 10;

/**
 * Device tokens of each account. A token belongs to one account at a time:
 * registering it under another account moves it there.
 */
export interface PushTokenStore {
  register(userId: string, token: string, platform: PushPlatform): Promise<void>;
  /** Removes [token] only if it belongs to [userId]. */
  remove(userId: string, token: string): Promise<void>;
  tokensOf(userIds: readonly string[]): Promise<string[]>;
  /** Removes tokens FCM reported as gone, whoever owns them. */
  forget(tokens: readonly string[]): Promise<void>;
  removeAllOf(userId: string): Promise<void>;
}

/** What a push carries, without its target. Shapes follow firebase-admin. */
export interface PushContent {
  notification?: { title?: string; body?: string; imageUrl?: string };
  data?: Record<string, string>;
  android?: object;
  apns?: object;
  webpush?: object;
  fcmOptions?: object;
}

export interface PushSendResponse {
  success: boolean;
  error?: { code: string };
}

export interface PushBatchResponse {
  successCount: number;
  failureCount: number;
  responses: PushSendResponse[];
}

/** The part of firebase-admin `Messaging` the module uses; pass `admin.messaging()`. */
export interface PushMessaging {
  sendEachForMulticast(message: PushContent & { tokens: string[] }): Promise<PushBatchResponse>;
  sendEach(messages: (PushContent & { topic: string })[]): Promise<PushBatchResponse>;
  send(message: PushContent & { topic: string }): Promise<string>;
}

export interface PushLogger {
  info(message: string, fields?: object): void;
  warn(message: string, fields?: object): void;
}

export interface PushOptions {
  store: PushTokenStore;
  messaging: PushMessaging;
  /**
   * The signed-in account of a request, as the backend's auth guard left it
   * (e.g. `(req) => req.user?.uid`). Missing or throwing → 401. Never read
   * from the body. The backend's auth guard must cover the route.
   */
  userIdOf: (request: unknown) => string | null | undefined | Promise<string | null | undefined>;
  /**
   * Transition period: personal pushes also go to this topic of each user
   * (e.g. `(uid) => uid` for apps that still subscribe to `{uid}`). Topics are
   * open to any client, so drop it once old builds are gone.
   */
  legacyUserTopic?: (userId: string) => string;
  logger?: PushLogger;
}

/** Outcome of a personal send. Counts only, never tokens or user ids. */
export interface PushReport {
  tokens: number;
  sent: number;
  failed: number;
  removed: number;
  topicSent: number;
  topicFailed: number;
  /** FCM error code → number of failures. */
  errors: Record<string, number>;
}
