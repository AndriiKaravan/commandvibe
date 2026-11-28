import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NOTIFICATIONS, NotificationRepository } from '../src/data/repositories';
import { OidcVerifier } from '../src/game/tick.guard';
import { PUSH_MESSAGING } from '../src/notifications/push-messaging';
import { localDayStart } from '../src/notifications/quiet-hours';
import { FakePushMessaging } from '../src/shared/push/testing';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

const invoker = 'commandvibe-scheduler@commandvibe-ks.iam.gserviceaccount.com';
const verifier: OidcVerifier = {
  async verify() {
    return { email: invoker, emailVerified: true };
  },
};

describe('Evening reminder', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();
  const clock = { now: new Date() };
  let fixture: ReturnType<typeof gameFixture>;

  beforeAll(async () => {
    app = await createTestApp({
      firebase,
      clock,
      tick: { config: { audience: 'https://api.test', invoker }, verifier },
    });
    fixture = gameFixture(app, firebase);
  });

  afterAll(async () => {
    await app.close();
  });

  const tick = () => request(app.getHttpServer()).post('/internal/tick').set('authorization', 'Bearer good');
  const at = (hour: number) => new Date(localDayStart(new Date(), 'Europe/Kyiv').getTime() + hour * 3600_000);

  it('should remind only the player who has not done the day, once, with a push', async () => {
    clock.now = at(10);
    const game = await fixture.startedGame();
    const ira = await fixture.join(game.token, 'Ira');
    const taras = await fixture.join(game.token, 'Taras');
    await fixture.submit(game.groupId, taras);
    await fixture
      .api()
      .put('/me/push-token')
      .set('authorization', ira.auth)
      .send({ token: 'tok-ira', platform: 'ios' });
    await fixture
      .api()
      .put('/me/push-token')
      .set('authorization', taras.auth)
      .send({ token: 'tok-taras', platform: 'ios' });
    const messaging: FakePushMessaging = app.get(PUSH_MESSAGING);
    messaging.multicasts.length = 0;

    clock.now = at(19.5);
    await tick().expect(201);
    await tick().expect(201);

    expect(messaging.sentTokens).toEqual(['tok-ira']);
    expect(messaging.multicasts[0].data).toEqual({ route: `/g/${game.groupId}/today`, kind: 'reminder' });
    // Access tokens expire on the moved clock, so read the stored entries directly.
    const kinds = async (memberId: string) =>
      (await app.get<NotificationRepository>(NOTIFICATIONS).list(game.groupId, memberId, 50)).map((n) => n.kind);
    expect(await kinds(ira.memberId)).toContain('reminder');
    expect(await kinds(taras.memberId)).not.toContain('reminder');
  });
});
