export interface FeedPosition {
  submittedAt: Date;
  dayIndex: number;
  memberId: string;
}

/** Opaque position of the last item a client has seen. */
export function encodeCursor(position: FeedPosition): string {
  const raw = { t: position.submittedAt.getTime(), d: position.dayIndex, m: position.memberId };
  return Buffer.from(JSON.stringify(raw), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): FeedPosition | undefined {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const { t, d, m } = parsed as Record<string, unknown>;
    if (typeof t !== 'number' || !Number.isFinite(t) || !Number.isInteger(d) || typeof m !== 'string' || !m) {
      return undefined;
    }
    return { submittedAt: new Date(t), dayIndex: d as number, memberId: m };
  } catch {
    return undefined;
  }
}
