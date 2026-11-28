import { INestApplication } from '@nestjs/common';
import { GROUPS } from '../src/data/repositories';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Likes', () => {
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

  const like = (groupId: string, auth: string, authorId: string, method: 'put' | 'delete' = 'put') =>
    fixture.api()[method](`/groups/${groupId}/days/0/submissions/${authorId}/like`).set('authorization', auth);
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

  it('should count a like, show who gave it and let it be taken back', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    expect((await like(groupId, taras.auth, ira.memberId)).status).toBe(204);
    const seen = await feedOf(groupId, ira.auth);
    const photo = seen.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId);
    expect(photo.likes.count).toBe(1);
    expect(photo.likes.mine).toBe(false);
    expect(photo.likes.by.map((l: { displayName: string }) => l.displayName)).toEqual(['Taras']);
    const byTaras = await feedOf(groupId, taras.auth);
    expect(byTaras.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).likes.mine).toBe(true);
    expect((await like(groupId, taras.auth, ira.memberId, 'delete')).status).toBe(204);
    const after = await feedOf(groupId, ira.auth);
    expect(after.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).likes.count).toBe(0);
  });

  it('should hide the names from everyone, the author included, when only the count is shown', async () => {
    const { owner, groupId, ira, taras } = await twoPlayers();
    const groups = app.get(GROUPS, { strict: false });
    const group = await groups.get(groupId);
    await groups.update(groupId, { settings: { ...group!.settings, likesCountOnly: true } });
    await like(groupId, taras.auth, ira.memberId);
    for (const auth of [ira.auth, taras.auth]) {
      const response = await feedOf(groupId, auth);
      const photo = response.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId);
      expect(photo.likes.count).toBe(1);
      expect(photo.likes.by).toBeUndefined();
      expect(JSON.stringify(photo)).not.toContain('Taras');
    }
    // An organizer who does not play sees the photo blurred, so no likes and certainly no names.
    const forOwner = (await feedOf(groupId, owner)).body.items.find(
      (i: { memberId: string }) => i.memberId === ira.memberId,
    );
    expect(forOwner.likes).toEqual({ count: 0, mine: false });
  });

  it('should refuse liking your own photo and a photo you only see blurred', async () => {
    const { startedGame, join, submit } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    expect((await like(groupId, ira.auth, ira.memberId)).status).toBe(403);
    expect((await like(groupId, taras.auth, ira.memberId)).status).toBe(403);
  });

  it('should refuse a hidden photo, a stranger and a missing session', async () => {
    const { owner, groupId, ira, taras } = await twoPlayers();
    await fixture
      .api()
      .put(`/groups/${groupId}/days/0/submissions/${ira.memberId}/hidden`)
      .set('authorization', owner)
      .send({ hidden: true });
    expect((await like(groupId, taras.auth, ira.memberId)).status).toBe(403);
    const other = await fixture.startedGame();
    const outsider = await fixture.join(other.token, 'Outsider');
    expect((await like(groupId, outsider.auth, ira.memberId)).status).toBe(403);
    expect((await fixture.api().put(`/groups/${groupId}/days/0/submissions/${ira.memberId}/like`)).status).toBe(401);
  });

  it('should refuse an organizer who does not play', async () => {
    const { owner, groupId, ira } = await twoPlayers();
    expect((await like(groupId, owner, ira.memberId)).status).toBe(403);
  });

  it('should drop the likes when the photo is replaced', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    await like(groupId, taras.auth, ira.memberId);
    const current = await feedOf(groupId, ira.auth);
    const version = current.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).version;
    expect(version).toBeDefined();
    const bytes = await (await import('../src/photos/testing/fixture-images')).jpeg({ width: 640, height: 480 });
    const replaced = await fixture
      .api()
      .put(`/groups/${groupId}/days/0/submission?replaces=${version}`)
      .set('authorization', ira.auth)
      .set('content-type', 'image/jpeg')
      .send(bytes);
    expect(replaced.status).toBe(200);
    const after = await feedOf(groupId, ira.auth);
    expect(after.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).likes.count).toBe(0);
  });

  it('should drop the likes a removed member gave and received', async () => {
    const { owner, groupId, ira, taras } = await twoPlayers();
    await like(groupId, taras.auth, ira.memberId);
    await like(groupId, ira.auth, taras.memberId);
    await fixture
      .api()
      .post(`/groups/${groupId}/members/${taras.memberId}/remove`)
      .set('authorization', owner)
      .expect(204);
    const after = await feedOf(groupId, ira.auth);
    expect(after.body.items).toHaveLength(1);
    expect(after.body.items[0].likes.count).toBe(0);
  });
});
