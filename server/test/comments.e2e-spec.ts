import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';
import { TestSocket } from './ws-client';

describe('Comments', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();
  let fixture: ReturnType<typeof gameFixture>;

  beforeAll(async () => {
    app = await createTestApp({ firebase });
    fixture = gameFixture(app, firebase);
  });

  afterAll(async () => {
    await app.close();
  });

  const base = (groupId: string, authorId: string) => `/groups/${groupId}/days/0/submissions/${authorId}/comments`;
  const write = (groupId: string, auth: string, authorId: string, text: unknown) =>
    fixture.api().post(base(groupId, authorId)).set('authorization', auth).send({ text });
  const read = (groupId: string, auth: string, authorId: string) =>
    fixture.api().get(base(groupId, authorId)).set('authorization', auth);
  const feedOf = (groupId: string, auth: string) =>
    fixture.api().get(`/groups/${groupId}/feed`).set('authorization', auth);

  async function twoPlayers() {
    const { startedGame, join, submit } = fixture;
    const game = await startedGame();
    const ira = await join(game.token, 'Ira');
    const taras = await join(game.token, 'Taras');
    await submit(game.groupId, ira);
    await submit(game.groupId, taras);
    return { ...game, ira, taras };
  }

  it('should let players write and read comments under a photo they see, oldest first', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    expect((await write(groupId, taras.auth, ira.memberId, 'First')).status).toBe(201);
    expect((await write(groupId, ira.auth, ira.memberId, 'Second')).status).toBe(201);
    const response = await read(groupId, ira.auth, ira.memberId);
    expect(response.status).toBe(200);
    expect(response.body.items.map((c: { text: string }) => c.text)).toEqual(['First', 'Second']);
    expect(response.body.items[0]).toMatchObject({ displayName: 'Taras', mine: false, canDelete: false });
    expect(response.body.items[1]).toMatchObject({ displayName: 'Ira', mine: true, canDelete: true });
  });

  it('should count the comments on the photo in the feed', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    await write(groupId, taras.auth, ira.memberId, 'One');
    await write(groupId, taras.auth, ira.memberId, 'Two');
    const feed = await feedOf(groupId, taras.auth);
    expect(feed.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).commentCount).toBe(2);
  });

  it('should keep comments away from someone who has not done the task yet', async () => {
    const { startedGame, join, submit } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    expect((await write(groupId, taras.auth, ira.memberId, 'hi')).status).toBe(403);
    expect((await read(groupId, taras.auth, ira.memberId)).status).toBe(403);
  });

  it('should reject empty, blank and over-long text', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    for (const text of ['', '   ', 'x'.repeat(501), 7]) {
      expect((await write(groupId, taras.auth, ira.memberId, text)).status).toBe(400);
    }
    expect((await write(groupId, taras.auth, ira.memberId, 'x'.repeat(500))).status).toBe(201);
  });

  it('should let the writer and the organizer delete, and nobody else', async () => {
    const { owner, groupId, ira, taras } = await twoPlayers();
    const first = await write(groupId, taras.auth, ira.memberId, 'mine');
    const second = await write(groupId, taras.auth, ira.memberId, 'rude');
    const remove = (auth: string, id: string) =>
      fixture
        .api()
        .delete(`${base(groupId, ira.memberId)}/${id}`)
        .set('authorization', auth);
    expect((await remove(ira.auth, first.body.id)).status).toBe(403);
    expect((await remove(taras.auth, first.body.id)).status).toBe(204);
    expect((await remove(owner, second.body.id)).status).toBe(204);
    expect((await read(groupId, ira.auth, ira.memberId)).body.items).toEqual([]);
    expect((await remove(owner, second.body.id)).status).toBe(404);
  });

  it('should refuse an organizer who does not play when writing, but let them read what they see', async () => {
    const { owner, groupId, ira } = await twoPlayers();
    expect((await write(groupId, owner, ira.memberId, 'hi')).status).toBe(403);
  });

  it('should refuse a stranger and a missing session', async () => {
    const { groupId, ira } = await twoPlayers();
    const other = await fixture.startedGame();
    const outsider = await fixture.join(other.token, 'Outsider');
    expect((await read(groupId, outsider.auth, ira.memberId)).status).toBe(403);
    expect((await fixture.api().get(base(groupId, ira.memberId))).status).toBe(401);
  });

  it('should drop the comments when the photo is replaced and when a member is removed', async () => {
    const { owner, groupId, ira, taras } = await twoPlayers();
    await write(groupId, taras.auth, ira.memberId, 'under ira');
    await write(groupId, ira.auth, taras.memberId, 'by ira');
    const current = await feedOf(groupId, ira.auth);
    const version = current.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).version;
    const bytes = await (await import('../src/photos/testing/fixture-images')).jpeg({ width: 640, height: 480 });
    await fixture
      .api()
      .put(`/groups/${groupId}/days/0/submission?replaces=${version}`)
      .set('authorization', ira.auth)
      .set('content-type', 'image/jpeg')
      .send(bytes)
      .expect(200);
    expect((await read(groupId, taras.auth, ira.memberId)).body.items).toEqual([]);
    await fixture
      .api()
      .post(`/groups/${groupId}/members/${ira.memberId}/remove`)
      .set('authorization', owner)
      .expect(204);
    expect(
      (await feedOf(groupId, taras.auth)).body.items.find((i: { memberId: string }) => i.memberId === taras.memberId)
        .commentCount,
    ).toBe(0);
  });

  it('should announce a new comment to the group without its text', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    const socket = await TestSocket.connect(app, taras.auth.replace('Bearer ', ''));
    try {
      await socket.next((frame) => frame.t === 'ready');
      const id = socket.subscribe(`group:${groupId}`);
      await socket.next((frame) => frame.t === 'ack' && frame.id === id && Array.isArray(frame.ok));
      await write(groupId, ira.auth, ira.memberId, 'secret words');
      const event = await socket.next((frame) => frame.t === 'event' && frame.type === 'comment.created');
      expect(event.data).toEqual({ dayIndex: 0, memberId: ira.memberId, by: ira.memberId });
      expect(JSON.stringify(event)).not.toContain('secret');
    } finally {
      socket.close();
    }
  });
});
