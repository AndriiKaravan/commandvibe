// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { decodeClientFrame, frames, isValidTopic } from './protocol';

describe('decodeClientFrame', () => {
  it('should return a null frame for an unknown t', () => {
    expect(decodeClientFrame('{"t":"later","x":1}')).toEqual({
      ok: true,
      frame: null,
    });
  });

  it('should drop unknown fields', () => {
    expect(decodeClientFrame('{"t":"ping","extra":true}')).toEqual({
      ok: true,
      frame: { t: 'ping' },
    });
  });

  it('should reject a non-integer id', () => {
    expect(
      decodeClientFrame('{"t":"sub","id":1.5,"topics":["a:b"]}'),
    ).toMatchObject({ ok: false });
  });

  it('should reject a non-object JSON value', () => {
    expect(decodeClientFrame('[1]')).toMatchObject({ ok: false });
    expect(decodeClientFrame('null')).toMatchObject({ ok: false });
  });

  it('should drop client fields of the wrong type', () => {
    expect(
      decodeClientFrame(
        '{"t":"hello","v":1,"token":"x","client":{"app":"a","build":"45","platform":7}}',
      ),
    ).toEqual({ ok: true, frame: { t: 'hello', v: 1, token: 'x', client: { app: 'a' } } });
  });
});

describe('isValidTopic', () => {
  it('should accept a kind:id topic of 128 characters', () => {
    expect(isValidTopic(`group:${'a'.repeat(122)}`)).toBe(true);
  });

  it('should reject a topic of 129 characters', () => {
    expect(isValidTopic(`group:${'a'.repeat(123)}`)).toBe(false);
  });

  it('should reject a topic without a kind prefix', () => {
    expect(isValidTopic('group')).toBe(false);
    expect(isValidTopic(':abc')).toBe(false);
    expect(isValidTopic('Group:abc')).toBe(false);
    expect(isValidTopic('group:a b')).toBe(false);
  });
});

describe('frames.ack', () => {
  it('should omit empty ok and denied', () => {
    expect(JSON.parse(frames.ack({ id: 2, ok: [], denied: [] }))).toEqual({
      t: 'ack',
      id: 2,
    });
  });
});

describe('frames.ready', () => {
  it('should omit exp when the token has none', () => {
    expect(
      JSON.parse(frames.ready({ v: 1, sid: 's', hb: 25000, topics: [] })),
    ).toEqual({ t: 'ready', v: 1, sid: 's', hb: 25000, topics: [] });
  });
});
