// generated from ks_server/push — do not edit; run: npm run sync:push
import { DEFAULT_MAX_TOKENS_PER_USER, PushPlatform, PushTokenStore } from './push.types';

interface Entry {
  userId: string;
  platform: PushPlatform;
  updatedAt: number;
}

export interface InMemoryPushTokenStoreOptions {
  maxTokensPerUser?: number;
  now?: () => Date;
}

/** Process-local store for tests and backends running without a database. */
export class InMemoryPushTokenStore implements PushTokenStore {
  private readonly entries = new Map<string, Entry>();
  private readonly maxTokensPerUser: number;
  private readonly now: () => Date;

  constructor(options: InMemoryPushTokenStoreOptions = {}) {
    this.maxTokensPerUser = options.maxTokensPerUser ?? DEFAULT_MAX_TOKENS_PER_USER;
    this.now = options.now ?? (() => new Date());
  }

  async register(userId: string, token: string, platform: PushPlatform): Promise<void> {
    this.entries.delete(token);
    this.entries.set(token, { userId, platform, updatedAt: this.now().getTime() });
    const own = [...this.entries].filter(([, entry]) => entry.userId === userId);
    own.sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
    for (const [stale] of own.slice(this.maxTokensPerUser)) this.entries.delete(stale);
  }

  async remove(userId: string, token: string): Promise<void> {
    if (this.entries.get(token)?.userId === userId) this.entries.delete(token);
  }

  async tokensOf(userIds: readonly string[]): Promise<string[]> {
    const wanted = new Set(userIds);
    return [...this.entries].filter(([, entry]) => wanted.has(entry.userId)).map(([token]) => token);
  }

  async forget(tokens: readonly string[]): Promise<void> {
    for (const token of tokens) this.entries.delete(token);
  }

  async removeAllOf(userId: string): Promise<void> {
    for (const [token, entry] of this.entries) {
      if (entry.userId === userId) this.entries.delete(token);
    }
  }
}
