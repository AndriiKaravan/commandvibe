/** The built-in collection; the app maps each id to its picture, so ids must stay stable. */
export const avatarIds: readonly string[] = Array.from(
  { length: 24 },
  (_, index) => `av${String(index + 1).padStart(2, '0')}`,
);

export function isAvatarId(value: unknown): value is string {
  return typeof value === 'string' && avatarIds.includes(value);
}
