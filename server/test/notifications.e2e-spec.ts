import { INestApplication } from '@nestjs/common';
import { NotificationsService } from '../src/notifications/notifications.service';
import { organizerKey } from '../src/notifications/notification-kinds';
import { GROUPS } from '../src/data/repositories';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Notifications', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();
  let fixture: ReturnType<typeof gameFixture>;
  let service: NotificationsService;

  beforeAll(async () => {
    app = await createTestApp({ firebase });
    fixture = gameFixture(app, firebase);
    service = app.get(NotificationsService);
  });

  afterAll(async () => {
    await app.close();
  });

  const list = (groupId: string, auth: string) =>
    fixture.api().get(`/groups/${groupId}/notifications`).set('authorization', auth);

  it('should show each member only their own entries', async () => {
    const game = await fixture.startedGame();
    const ira = await fixture.join(game.token, 'Ira');
    const taras = await fixture.join(game.token, 'Taras');
    await service.record({ groupId: game.groupId, memberId: ira.memberId, kind: 'day_opened', key: 'd0', dayIndex: 0 });
    const mine = await list(game.groupId, ira.auth);
    expect(mine.status).toBe(200);
    expect(mine.body.unread).toBe(1);
    expect(mine.body.items[0]).toMatchObject({ kind: 'day_opened', dayIndex: 0, read: false });
    expect((await list(game.groupId, taras.auth)).body).toEqual({ items: [], unread: 0 });
  });

  it('should mark entries read, all or chosen', async () => {
    const game = await fixture.startedGame();
    const ira = await fixture.join(game.token, 'Ira');
    for (const key of ['d0', 'd1']) {
      await service.record({ groupId: game.groupId, memberId: ira.memberId, kind: 'day_opened', key });
    }
    const send = (body: object) =>
      fixture.api().post(`/groups/${game.groupId}/notifications/read`).set('authorization', ira.auth).send(body);
    expect((await send({ ids: [`${ira.memberId}_d0`] })).status).toBe(204);
    expect((await list(game.groupId, ira.auth)).body.unread).toBe(1);
    expect((await send({})).status).toBe(204);
    expect((await list(game.groupId, ira.auth)).body.unread).toBe(0);
  });

  it('should refuse a stranger, another group’s member and a missing session', async () => {
    const one = await fixture.startedGame();
    const other = await fixture.startedGame();
    const ira = await fixture.join(one.token, 'Ira');
    expect((await list(other.groupId, ira.auth)).status).toBe(403);
    expect((await fixture.api().get(`/groups/${one.groupId}/notifications`)).status).toBe(401);
    expect((await list(other.groupId, one.owner)).status).toBe(403);
  });

  it('should give a non-playing organizer their own service list', async () => {
    const game = await fixture.startedGame();
    const group = await app.get(GROUPS).get(game.groupId);
    await service.record({
      groupId: game.groupId,
      memberId: organizerKey(group!.ownerUid),
      kind: 'complaint',
      key: 'c1',
      dayIndex: 0,
      owner: true,
    });
    const response = await list(game.groupId, game.owner);
    expect(response.status).toBe(200);
    expect(response.body.items.map((i: { kind: string }) => i.kind)).toEqual(['complaint']);
  });

  it('should not show service entries to players', async () => {
    const game = await fixture.startedGame();
    const group = await app.get(GROUPS).get(game.groupId);
    const ira = await fixture.join(game.token, 'Ira');
    await service.record({
      groupId: game.groupId,
      memberId: organizerKey(group!.ownerUid),
      kind: 'complaint',
      key: 'c1',
      owner: true,
    });
    expect((await list(game.groupId, ira.auth)).body.items).toEqual([]);
  });
});
