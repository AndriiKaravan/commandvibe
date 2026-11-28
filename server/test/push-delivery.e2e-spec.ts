import { INestApplication } from '@nestjs/common';
import { PUSH_MESSAGING } from '../src/notifications/push-messaging';
import { localDayStart } from '../src/notifications/quiet-hours';
import { FakePushMessaging } from '../src/shared/push/testing';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Push delivery', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();
  const clock = { now: new Date() };
  let fixture: ReturnType<typeof gameFixture>;
  let messaging: FakePushMessaging;

  beforeAll(async () => {
    app = await createTestApp({ firebase, clock });
    fixture = gameFixture(app, firebase);
    messaging = app.get(PUSH_MESSAGING);
  });

  afterAll(async () => {
    await app.close();
  });

  async function twoPlayers() {
    const game = await fixture.startedGame();
    const ira = await fixture.join(game.token, 'Ira');
    const taras = await fixture.join(game.token, 'Taras');
    await fixture.submit(game.groupId, ira);
    await fixture.submit(game.groupId, taras);
    for (const [player, token] of [
      [ira, 'tok-ira'],
      [taras, 'tok-taras'],
    ] as const) {
      await fixture.api().put('/me/push-token').set('authorization', player.auth).send({ token, platform: 'ios' });
    }
    messaging.multicasts.length = 0;
    return { ...game, ira, taras };
  }

  const comment = (groupId: string, auth: string, authorId: string) =>
    fixture
      .api()
      .post(`/groups/${groupId}/days/0/submissions/${authorId}/comments`)
      .set('authorization', auth)
      .send({ text: 'Private words' });

  it('should push a comment to the photo’s author only, without its text', async () => {
    clock.now = new Date(localDayStart(new Date(), 'Europe/Kyiv').getTime() + 10 * 3600_000);
    const { groupId, ira, taras } = await twoPlayers();
    await comment(groupId, taras.auth, ira.memberId).expect(201);
    expect(messaging.sentTokens).toEqual(['tok-ira']);
    expect(JSON.stringify(messaging.multicasts)).not.toContain('Private words');
    expect(messaging.multicasts[0].data).toEqual({ route: `/g/${groupId}/feed`, kind: 'comment' });
  });

  it('should stay silent at night but still record the comment in the app', async () => {
    clock.now = new Date(localDayStart(new Date(), 'Europe/Kyiv').getTime() + 23 * 3600_000);
    const { groupId, ira, taras } = await twoPlayers();
    await comment(groupId, taras.auth, ira.memberId).expect(201);
    expect(messaging.multicasts).toEqual([]);
    const list = await fixture.api().get(`/groups/${groupId}/notifications`).set('authorization', ira.auth);
    expect(list.body.items.map((i: { kind: string }) => i.kind)).toContain('comment');
  });

  it('should not push a member who switched social notifications off', async () => {
    clock.now = new Date(localDayStart(new Date(), 'Europe/Kyiv').getTime() + 10 * 3600_000);
    const { groupId, ira, taras } = await twoPlayers();
    await fixture
      .api()
      .put(`/groups/${groupId}/me/notification-settings`)
      .set('authorization', ira.auth)
      .send({ social: false })
      .expect(204);
    await comment(groupId, taras.auth, ira.memberId).expect(201);
    expect(messaging.multicasts).toEqual([]);
  });
});
