import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Progress', () => {
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

  it('should show a member how many finished day 0 and whether they did', async () => {
    const { api, startedGame, join, submit } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    expect((await submit(groupId, ira)).status).toBe(201);
    const response = await api().get(`/groups/${groupId}/progress`).set('authorization', taras.auth);
    expect(response.status).toBe(200);
    expect(response.body.days).toHaveLength(7);
    expect(response.body.days[0]).toEqual({ dayIndex: 0, done: 1, total: 2, mine: false });
    const own = await api().get(`/groups/${groupId}/progress`).set('authorization', ira.auth);
    expect(own.body.days[0].mine).toBe(true);
  });

  it('should give an organizer who does not play a null own flag', async () => {
    const { api, startedGame, join, submit } = fixture;
    const { owner, groupId, token } = await startedGame();
    await submit(groupId, await join(token, 'Ira'));
    const response = await api().get(`/groups/${groupId}/progress`).set('authorization', owner);
    expect(response.body.days[0]).toMatchObject({ done: 1, mine: null });
  });

  it('should refuse a stranger and a missing session', async () => {
    const { api, startedGame, join } = fixture;
    const first = await startedGame();
    const second = await startedGame();
    const outsider = await join(second.token, 'Outsider');
    expect((await api().get(`/groups/${first.groupId}/progress`).set('authorization', outsider.auth)).status).toBe(403);
    expect((await api().get(`/groups/${first.groupId}/progress`)).status).toBe(401);
  });
});
