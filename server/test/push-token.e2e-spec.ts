import { INestApplication } from '@nestjs/common';
import { PUSH_TOKEN_STORE } from '../src/notifications/push-messaging';
import { PushTokenStore } from '../src/shared/push';
import { gameFixture } from './game-fixture';
import { FakeFirebase, createTestApp } from './test-app';

describe('Push token', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();
  let fixture: ReturnType<typeof gameFixture>;
  let store: PushTokenStore;

  beforeAll(async () => {
    app = await createTestApp({ firebase });
    fixture = gameFixture(app, firebase);
    store = app.get(PUSH_TOKEN_STORE);
  });

  afterAll(async () => {
    await app.close();
  });

  const put = (auth: string | undefined, body: unknown) => {
    const call = fixture.api().put('/me/push-token');
    return (auth ? call.set('authorization', auth) : call).send(body as object);
  };

  it('should register a member device under the member account', async () => {
    const { token } = await fixture.startedGame();
    const ira = await fixture.join(token, 'Ira');
    expect((await put(ira.auth, { token: 'tok-ira', platform: 'android' })).status).toBe(204);
    expect(await store.tokensOf([`m:${ira.memberId}`])).toEqual(['tok-ira']);
  });

  it('should register an organizer device under the organizer account', async () => {
    const { owner } = await fixture.startedGame();
    expect((await put(owner, { token: 'tok-org', platform: 'web' })).status).toBe(204);
    const accounts = await store.tokensOf([...firebase.users.keys()].map((uid) => `o:${uid}`));
    expect(accounts).toContain('tok-org');
  });

  it('should refuse a request without a session', async () => {
    expect((await put(undefined, { token: 't', platform: 'ios' })).status).toBe(401);
  });

  it('should refuse an unknown platform and an empty token', async () => {
    const { token } = await fixture.startedGame();
    const ira = await fixture.join(token, 'Ira');
    expect((await put(ira.auth, { token: 't', platform: 'tv' })).status).toBe(400);
    expect((await put(ira.auth, { token: '', platform: 'ios' })).status).toBe(400);
  });

  it('should move a device token to the account that registers it last', async () => {
    const { token } = await fixture.startedGame();
    const ira = await fixture.join(token, 'Ira');
    const taras = await fixture.join(token, 'Taras');
    await put(ira.auth, { token: 'shared', platform: 'ios' });
    await put(taras.auth, { token: 'shared', platform: 'ios' });
    expect(await store.tokensOf([`m:${ira.memberId}`])).toEqual([]);
    expect(await store.tokensOf([`m:${taras.memberId}`])).toEqual(['shared']);
  });

  it('should remove only the caller’s own token', async () => {
    const { token } = await fixture.startedGame();
    const ira = await fixture.join(token, 'Ira');
    const taras = await fixture.join(token, 'Taras');
    await put(ira.auth, { token: 'ira-dev', platform: 'ios' });
    await fixture
      .api()
      .delete('/me/push-token')
      .set('authorization', taras.auth)
      .send({ token: 'ira-dev' })
      .expect(204);
    expect(await store.tokensOf([`m:${ira.memberId}`])).toEqual(['ira-dev']);
    await fixture.api().delete('/me/push-token').set('authorization', ira.auth).send({ token: 'ira-dev' }).expect(204);
    expect(await store.tokensOf([`m:${ira.memberId}`])).toEqual([]);
  });
});
