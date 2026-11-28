import { decodeCursor, encodeCursor } from './feed-cursor';

describe('feed cursor', () => {
  it('should round-trip a position', () => {
    const position = { submittedAt: new Date('2026-12-02T08:00:00.123Z'), dayIndex: 3, memberId: 'm-abc' };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it.each([
    '',
    'garbage',
    'e30',
    Buffer.from('{"t":"x","d":1,"m":"a"}').toString('base64url'),
    Buffer.from('[1,2]').toString('base64url'),
  ])('should refuse %p', (raw) => {
    expect(decodeCursor(raw)).toBeUndefined();
  });
});
