import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Standings', () => {
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

  const standingsOf = (groupId: string, auth: string) =>
    fixture.api().get(`/groups/${groupId}/standings`).set('authorization', auth);

  it('should rank players by points and tell each their own place', async () => {
    const { startedGame, join, submit } = fixture;
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taras = await join(token, 'Taras');
    await submit(groupId, ira);
    const response = await standingsOf(groupId, taras.auth);
    expect(response.status).toBe(200);
    expect(
      response.body.items.map((i: { displayName: string; points: number; rank: number }) => [
        i.displayName,
        i.points,
        i.rank,
      ]),
    ).toEqual([
      ['Ira', 15, 1],
      ['Taras', 0, 2],
    ]);
    expect(response.body.me).toEqual({ rank: 2, points: 0, toNext: 15 });
  });

  it('should take points away when the organizer hides a photo', async () => {
    const { api, startedGame, join, submit } = fixture;
    const { owner, groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    await submit(groupId, ira);
    await api()
      .put(`/groups/${groupId}/days/0/submissions/${ira.memberId}/hidden`)
      .set('authorization', owner)
      .send({ hidden: true })
      .expect(204);
    const response = await standingsOf(groupId, ira.auth);
    expect(response.body.items[0]).toMatchObject({ displayName: 'Ira', points: 0 });
  });

  it('should refuse a stranger and a missing session', async () => {
    const { api, startedGame, join } = fixture;
    const first = await startedGame();
    const second = await startedGame();
    const outsider = await join(second.token, 'Outsider');
    expect((await standingsOf(first.groupId, outsider.auth)).status).toBe(403);
    expect((await api().get(`/groups/${first.groupId}/standings`)).status).toBe(401);
  });
});
