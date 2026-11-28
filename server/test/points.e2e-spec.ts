import { INestApplication } from '@nestjs/common';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Points', () => {
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

  const journalOf = (groupId: string, auth: string) =>
    fixture.api().get(`/groups/${groupId}/points`).set('authorization', auth);
  const standingsOf = (groupId: string, auth: string) =>
    fixture.api().get(`/groups/${groupId}/standings`).set('authorization', auth);
  const like = (groupId: string, auth: string, authorId: string, method: 'put' | 'delete' = 'put') =>
    fixture.api()[method](`/groups/${groupId}/days/0/submissions/${authorId}/like`).set('authorization', auth);

  async function twoPlayers() {
    const { startedGame, join, submit } = fixture;
    const game = await startedGame();
    const ira = await join(game.token, 'Ira');
    const taras = await join(game.token, 'Taras');
    await submit(game.groupId, ira);
    await submit(game.groupId, taras);
    return { ...game, ira, taras };
  }

  it('should show where the points of the first and the second player come from', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    const first = await journalOf(groupId, ira.auth);
    expect(first.status).toBe(200);
    expect(first.body.entries.map((e: { kind: string }) => e.kind)).toEqual(['done', 'speed', 'goal']);
    expect(first.body.entries[1]).toMatchObject({ amount: 5, detail: 1 });
    expect(first.body.total).toBe(10 + 5 + 3);
    const second = await journalOf(groupId, taras.auth);
    expect(second.body.entries[1]).toMatchObject({ amount: 3, detail: 2 });
    expect(second.body.total).toBe(10 + 3 + 3);
  });

  it('should add the spectators sympathy for a like and take it away with the like', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    await like(groupId, taras.auth, ira.memberId);
    const liked = await journalOf(groupId, ira.auth);
    expect(liked.body.entries.find((e: { kind: string }) => e.kind === 'sympathy')).toMatchObject({
      amount: 5,
      detail: 1,
    });
    expect(liked.body.total).toBe(10 + 5 + 3 + 5);
    const standings = await standingsOf(groupId, taras.auth);
    expect(standings.body.items[0]).toMatchObject({ displayName: 'Ira', points: 23, fans: 1, rank: 1 });
    await like(groupId, taras.auth, ira.memberId, 'delete');
    const after = await standingsOf(groupId, taras.auth);
    expect(after.body.items.find((i: { displayName: string }) => i.displayName === 'Ira')).toMatchObject({
      points: 18,
      fans: 0,
    });
  });

  it('should keep the rating equal to the sum of each journal', async () => {
    const { groupId, ira, taras } = await twoPlayers();
    await like(groupId, ira.auth, taras.memberId);
    const standings = await standingsOf(groupId, ira.auth);
    for (const [player, name] of [
      [ira, 'Ira'],
      [taras, 'Taras'],
    ] as const) {
      const journal = await journalOf(groupId, player.auth);
      expect(standings.body.items.find((i: { displayName: string }) => i.displayName === name).points).toBe(
        journal.body.total,
      );
    }
  });

  it('should take the points away when the organizer hides a photo', async () => {
    const { owner, groupId, ira, taras } = await twoPlayers();
    await fixture
      .api()
      .put(`/groups/${groupId}/days/0/submissions/${ira.memberId}/hidden`)
      .set('authorization', owner)
      .send({ hidden: true })
      .expect(204);
    expect((await journalOf(groupId, ira.auth)).body).toEqual({ total: 0, entries: [] });
    expect(
      (await standingsOf(groupId, taras.auth)).body.items.find((i: { displayName: string }) => i.displayName === 'Ira')
        .points,
    ).toBe(0);
  });

  it('should refuse the journal to an organizer who does not play, a stranger and a missing session', async () => {
    const { owner, groupId } = await twoPlayers();
    expect((await journalOf(groupId, owner)).status).toBe(403);
    const other = await fixture.startedGame();
    const outsider = await fixture.join(other.token, 'Outsider');
    expect((await journalOf(groupId, outsider.auth)).status).toBe(403);
    expect((await fixture.api().get(`/groups/${groupId}/points`)).status).toBe(401);
  });
});
