import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Notification settings', () => {
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

  const url = (groupId: string) => `/groups/${groupId}/me/notification-settings`;
  const get = (groupId: string, auth: string) => fixture.api().get(url(groupId)).set('authorization', auth);
  const put = (groupId: string, auth: string, body: unknown) =>
    fixture
      .api()
      .put(url(groupId))
      .set('authorization', auth)
      .send(body as object);

  it('should start with everything on and keep each switch on its own', async () => {
    const game = await fixture.startedGame();
    const ira = await fixture.join(game.token, 'Ira');
    expect((await get(game.groupId, ira.auth)).body).toEqual({ tasks: true, social: true, playing: true });
    expect((await put(game.groupId, ira.auth, { tasks: false })).status).toBe(204);
    expect((await get(game.groupId, ira.auth)).body).toEqual({ tasks: false, social: true, playing: true });
    await put(game.groupId, ira.auth, { social: false });
    expect((await get(game.groupId, ira.auth)).body).toMatchObject({ tasks: false, social: false });
  });

  it('should keep one member’s switches from touching another’s', async () => {
    const game = await fixture.startedGame();
    const ira = await fixture.join(game.token, 'Ira');
    const taras = await fixture.join(game.token, 'Taras');
    await put(game.groupId, ira.auth, { tasks: false });
    expect((await get(game.groupId, taras.auth)).body.tasks).toBe(true);
  });

  it('should refuse a bad body and an empty one', async () => {
    const game = await fixture.startedGame();
    const ira = await fixture.join(game.token, 'Ira');
    expect((await put(game.groupId, ira.auth, { tasks: 'no' })).status).toBe(400);
    expect((await put(game.groupId, ira.auth, {})).status).toBe(400);
  });

  it('should refuse another group’s member and a missing session', async () => {
    const one = await fixture.startedGame();
    const other = await fixture.startedGame();
    const ira = await fixture.join(one.token, 'Ira');
    expect((await get(other.groupId, ira.auth)).status).toBe(403);
    expect((await fixture.api().get(url(one.groupId))).status).toBe(401);
  });

  it('should show a non-playing organizer that there is nothing to switch', async () => {
    const game = await fixture.startedGame();
    expect((await get(game.groupId, game.owner)).body).toMatchObject({ playing: false });
    expect((await put(game.groupId, game.owner, { tasks: false })).status).toBe(403);
  });
});
