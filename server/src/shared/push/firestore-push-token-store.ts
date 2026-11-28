// generated from ks_server/push — do not edit; run: npm run sync:push
import { createHash } from 'node:crypto';
import { DEFAULT_MAX_TOKENS_PER_USER, PushPlatform, PushTokenStore } from './push.types';

/*
 * The subset of firebase-admin Firestore the store touches. Structural, so the
 * module does not import firebase-admin: pass `admin.firestore()` / `getFirestore()`.
 */
export interface FirestoreDocLike {
  set(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface FirestoreSnapshotLike {
  readonly ref: FirestoreDocLike;
  data(): Record<string, unknown> | undefined;
}

export interface FirestoreQueryLike {
  get(): Promise<{ docs: FirestoreSnapshotLike[] }>;
}

export interface FirestoreCollectionLike {
  doc(id: string): FirestoreDocLike;
  where(field: string, op: '==' | 'in', value: unknown): FirestoreQueryLike;
}

export interface FirestoreTransactionLike {
  get(ref: FirestoreDocLike): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  delete(ref: FirestoreDocLike): unknown;
}

export interface FirestoreLike {
  collection(path: string): FirestoreCollectionLike;
  runTransaction<T>(update: (tx: FirestoreTransactionLike) => Promise<T>): Promise<T>;
}

export interface FirestorePushTokenStoreOptions {
  /** Default `push_tokens`. */
  collection?: string;
  maxTokensPerUser?: number;
  now?: () => Date;
}

// Firestore takes at most 30 values in one `in` filter.
const IN_QUERY_LIMIT = 30;

/**
 * One document per token, keyed by sha256(token) so a token belongs to one
 * account at a time: `{ uid, token, platform, updatedAt }`.
 */
export class FirestorePushTokenStore implements PushTokenStore {
  private readonly collectionName: string;
  private readonly maxTokensPerUser: number;
  private readonly now: () => Date;

  constructor(
    private readonly db: FirestoreLike,
    options: FirestorePushTokenStoreOptions = {},
  ) {
    this.collectionName = options.collection ?? 'push_tokens';
    this.maxTokensPerUser = options.maxTokensPerUser ?? DEFAULT_MAX_TOKENS_PER_USER;
    this.now = options.now ?? (() => new Date());
  }

  private get collection() {
    return this.db.collection(this.collectionName);
  }

  private refOf(token: string) {
    return this.collection.doc(createHash('sha256').update(token).digest('hex'));
  }

  async register(userId: string, token: string, platform: PushPlatform): Promise<void> {
    await this.refOf(token).set({ uid: userId, token, platform, updatedAt: this.now() });
    await this.dropOldest(userId);
  }

  async remove(userId: string, token: string): Promise<void> {
    const ref = this.refOf(token);
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data()?.uid === userId) tx.delete(ref);
    });
  }

  async tokensOf(userIds: readonly string[]): Promise<string[]> {
    const unique = [...new Set(userIds)];
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += IN_QUERY_LIMIT) chunks.push(unique.slice(i, i + IN_QUERY_LIMIT));
    const snaps = await Promise.all(chunks.map((chunk) => this.collection.where('uid', 'in', chunk).get()));
    return snaps.flatMap((snap) => snap.docs.map((doc) => doc.data()?.token)).filter(isString);
  }

  async forget(tokens: readonly string[]): Promise<void> {
    await Promise.all([...new Set(tokens)].map((token) => this.refOf(token).delete()));
  }

  /** A device still signed in can register again meanwhile: call after revoking sessions. */
  async removeAllOf(userId: string): Promise<void> {
    const snap = await this.collection.where('uid', '==', userId).get();
    await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
  }

  private async dropOldest(userId: string): Promise<void> {
    const snap = await this.collection.where('uid', '==', userId).get();
    if (snap.docs.length <= this.maxTokensPerUser) return;
    const newestFirst = [...snap.docs].sort((a, b) => millisOf(b) - millisOf(a));
    // Each delete re-checks the owner: another account may have taken the token since the query.
    await Promise.all(
      newestFirst.slice(this.maxTokensPerUser).map((doc) =>
        this.db.runTransaction(async (tx) => {
          const fresh = await tx.get(doc.ref);
          if (fresh.exists && fresh.data()?.uid === userId) tx.delete(doc.ref);
        }),
      ),
    );
  }
}

const isString = (value: unknown): value is string => typeof value === 'string';

/** `updatedAt` comes back as a firebase-admin Timestamp; a Date in fakes. */
function millisOf(doc: FirestoreSnapshotLike): number {
  const value = doc.data()?.updatedAt as { toMillis?: () => number; getTime?: () => number } | undefined;
  return value?.toMillis?.() ?? value?.getTime?.() ?? 0;
}
