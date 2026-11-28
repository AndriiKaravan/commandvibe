import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Group settings', () => {
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

  const patch = (groupId: string, auth: string, body: unknown) =>
    fixture
      .api()
      .patch(`/groups/${groupId}/settings`)
      .set('authorization', auth)
      .send(body as object);

  it('should let the organizer hide the names of those who liked, for everyone', async () => {
    const { startedGame, join, submit, api } = fixture;
    const { owner, groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    await submit(groupId, taras);
    await api().put(`/groups/${groupId}/days/0/submissions/${ira.memberId}/like`).set('authorization', taras.auth);
    const before = await api().get(`/groups/${groupId}/feed`).set('authorization', ira.auth);
    expect(before.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).likes.by).toHaveLength(1);

    expect((await patch(groupId, owner, { likesCountOnly: true })).status).toBe(204);
    const after = await api().get(`/groups/${groupId}/feed`).set('authorization', ira.auth);
    const photo = after.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId);
    expect(photo.likes.count).toBe(1);
    expect(photo.likes.by).toBeUndefined();

    expect((await patch(groupId, owner, { likesCountOnly: false })).status).toBe(204);
    const back = await api().get(`/groups/${groupId}/feed`).set('authorization', ira.auth);
    expect(back.body.items.find((i: { memberId: string }) => i.memberId === ira.memberId).likes.by).toHaveLength(1);
  });

  it('should reject a bad body and keep the setting', async () => {
    const { startedGame } = fixture;
    const { owner, groupId } = await startedGame();
    for (const body of [
      { likesCountOnly: 'yes' },
      {},
      { memberLimit: 3 },
      { likesCountOnly: true, approveNew: true },
    ]) {
      expect((await patch(groupId, owner, body)).status).toBe(400);
    }
  });

  it('should refuse a member, a stranger and a missing session', async () => {
    const { startedGame, join, api } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    expect((await patch(groupId, ira.auth, { likesCountOnly: true })).status).toBe(403);
    expect((await api().patch(`/groups/${groupId}/settings`).send({ likesCountOnly: true })).status).toBe(401);
  });
});
