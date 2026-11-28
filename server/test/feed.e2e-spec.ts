import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Feed', () => {
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

  const feedOf = (groupId: string, auth: string, query = '') =>
    fixture.api().get(`/groups/${groupId}/feed${query}`).set('authorization', auth);

  it('should blur a photo for someone who has not done the task and show it after', async () => {
    const { startedGame, join, submit } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    const before = await feedOf(groupId, taras.auth);
    expect(before.status).toBe(200);
    expect(before.body.items).toHaveLength(1);
    expect(before.body.items[0]).toMatchObject({ memberId: ira.memberId, access: 'blur', dayIndex: 0 });
    expect(before.body.items[0].photoUrl).toBeUndefined();
    expect(before.body.items[0].taskTitle.uk).toEqual(expect.any(String));
    await submit(groupId, taras);
    const after = await feedOf(groupId, taras.auth);
    const iras = after.body.items.find((item: { memberId: string }) => item.memberId === ira.memberId);
    expect(iras).toMatchObject({ access: 'full' });
    expect(iras.photoUrl).toEqual(expect.any(String));
  });

  it('should drop a hidden photo for everyone, the organizer included', async () => {
    const { api, startedGame, join, submit } = fixture;
    const { owner, groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    await submit(groupId, taras);
    await api()
      .put(`/groups/${groupId}/days/0/submissions/${ira.memberId}/hidden`)
      .set('authorization', owner)
      .send({ hidden: true })
      .expect(204);
    for (const auth of [owner, taras.auth, ira.auth]) {
      const response = await feedOf(groupId, auth);
      expect(response.body.items.map((item: { memberId: string }) => item.memberId)).toEqual([taras.memberId]);
    }
  });

  it('should not list the photo of a removed member', async () => {
    const { api, startedGame, join, submit } = fixture;
    const { owner, groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    await submit(groupId, taras);
    await api().post(`/groups/${groupId}/members/${ira.memberId}/remove`).set('authorization', owner).expect(204);
    const response = await feedOf(groupId, taras.auth);
    expect(response.body.items.map((item: { memberId: string }) => item.memberId)).toEqual([taras.memberId]);
  });

  it('should filter to own photos and page with a cursor', async () => {
    const { startedGame, join, submit } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    await submit(groupId, taras);
    const mine = await feedOf(groupId, ira.auth, '?mine=1');
    expect(mine.body.items.map((item: { memberId: string }) => item.memberId)).toEqual([ira.memberId]);
    const first = await feedOf(groupId, ira.auth, '?limit=1');
    expect(first.body.items).toHaveLength(1);
    expect(first.body.next).toEqual(expect.any(String));
    const second = await feedOf(groupId, ira.auth, `?limit=1&before=${first.body.next}`);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.next).toBeUndefined();
    expect(second.body.items[0].memberId).not.toBe(first.body.items[0].memberId);
  });

  it('should refuse a bad cursor, a stranger and a missing session', async () => {
    const { startedGame, join } = fixture;
    const first = await startedGame();
    const second = await startedGame();
    const ira = await join(first.token, 'Ira');
    const outsider = await join(second.token, 'Outsider');
    expect((await feedOf(first.groupId, ira.auth, '?before=nonsense')).status).toBe(400);
    expect((await feedOf(first.groupId, ira.auth, '?limit=500')).status).toBe(400);
    expect((await feedOf(first.groupId, outsider.auth)).status).toBe(403);
    expect((await fixture.api().get(`/groups/${first.groupId}/feed`)).status).toBe(401);
  });
});
