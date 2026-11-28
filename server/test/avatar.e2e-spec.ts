import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Avatar', () => {
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

  const setAvatar = (groupId: string, auth: string, avatar: unknown) =>
    fixture.api().put(`/groups/${groupId}/me/avatar`).set('authorization', auth).send({ avatar });

  it('should let a member pick, show and clear their avatar', async () => {
    const { api, startedGame, join, submit } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    expect((await setAvatar(groupId, ira.auth, 'av07')).status).toBe(204);
    const members = await api().get(`/groups/${groupId}/members`).set('authorization', taras.auth);
    expect(members.body.find((m: { id: string }) => m.id === ira.memberId).avatar).toBe('av07');
    await submit(groupId, ira);
    const feed = await api().get(`/groups/${groupId}/feed`).set('authorization', taras.auth);
    expect(feed.body.items[0].avatar).toBe('av07');
    expect((await setAvatar(groupId, ira.auth, null)).status).toBe(204);
    const cleared = await api().get(`/groups/${groupId}/members`).set('authorization', taras.auth);
    expect(cleared.body.find((m: { id: string }) => m.id === ira.memberId).avatar).toBeUndefined();
  });

  it('should refuse an id outside the collection', async () => {
    const { startedGame, join } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    for (const bad of ['av99', 'x', 5, {}]) {
      const response = await setAvatar(groupId, ira.auth, bad);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('invalid_avatar');
    }
  });

  it('should change only the caller own avatar', async () => {
    const { api, startedGame, join } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await setAvatar(groupId, ira.auth, 'av02');
    const members = await api().get(`/groups/${groupId}/members`).set('authorization', ira.auth);
    expect(members.body.find((m: { id: string }) => m.id === taras.memberId).avatar).toBeUndefined();
  });

  it('should let an organizer who plays pick one and refuse one who does not', async () => {
    const { api, startedGame } = fixture;
    const playing = await startedGame({ playsToo: true });
    expect((await setAvatar(playing.groupId, playing.owner, 'av05')).status).toBe(204);
    const members = await api().get(`/groups/${playing.groupId}/members`).set('authorization', playing.owner);
    expect(members.body.find((m: { isOrganizer: boolean }) => m.isOrganizer).avatar).toBe('av05');
    const watching = await startedGame({ playsToo: false });
    const response = await setAvatar(watching.groupId, watching.owner, 'av05');
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('not_playing');
  });

  it('should refuse a stranger and a missing session', async () => {
    const { api, startedGame, join } = fixture;
    const first = await startedGame();
    const second = await startedGame();
    const outsider = await join(second.token, 'Outsider');
    expect((await setAvatar(first.groupId, outsider.auth, 'av01')).status).toBe(403);
    expect((await api().put(`/groups/${first.groupId}/me/avatar`).send({ avatar: 'av01' })).status).toBe(401);
  });
});
