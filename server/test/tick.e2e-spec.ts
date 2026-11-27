import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OidcVerifier } from '../src/game/tick.guard';
import { FakeFirebase, createTestApp } from './test-app';
import { TestSocket } from './ws-client';

const invoker = 'commandvibe-scheduler@commandvibe-ks.iam.gserviceaccount.com';
const kyivToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

const verifier: OidcVerifier = {
  async verify(token) {
    if (token === 'good') return { email: invoker, emailVerified: true };
    if (token === 'stranger') return { email: 'x@y.test', emailVerified: true };
    throw new Error('bad token');
  },
};

describe('Scheduler tick', () => {
  describe('when the tick is not configured', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should answer 404', async () => {
      expect(
        (await request(app.getHttpServer()).post('/internal/tick').set('authorization', 'Bearer good')).status,
      ).toBe(404);
    });
  });

  describe('when configured', () => {
    let app: INestApplication;
    const firebase = new FakeFirebase();
    const sockets: TestSocket[] = [];

    beforeAll(async () => {
      app = await createTestApp({ firebase, tick: { config: { audience: 'https://api.test', invoker }, verifier } });
    });

    afterEach(() => {
      sockets.splice(0).forEach((socket) => socket.close());
    });

    afterAll(async () => {
      await app.close();
    });

    const http = () => request(app.getHttpServer());

    it('should refuse callers that are not the scheduler', async () => {
      expect((await http().post('/internal/tick')).status).toBe(401);
      expect((await http().post('/internal/tick').set('authorization', 'Bearer stranger')).status).toBe(401);
      expect((await http().post('/internal/tick').set('authorization', 'Bearer nope')).status).toBe(401);
    });

    it('should open due days for groups that nobody is looking at, once', async () => {
      const uid = `org-${Math.random().toString(36).slice(2)}`;
      firebase.users.set(uid, { uid, email: `${uid}@example.com`, name: 'Owner', provider: 'google.com' });
      const owner = `Bearer ${(await http().post('/auth/organizer').send({ idToken: uid })).body.accessToken}`;
      const created = await http()
        .post('/groups')
        .set('authorization', owner)
        .send({ name: 'Office', timezone: 'Europe/Kyiv', playsToo: false });
      const groupId = created.body.group.id as string;
      const joined = await http()
        .post('/join')
        .send({ token: (created.body.inviteUrl as string).split('/j/')[1], displayName: 'Ira' });
      await http()
        .put(`/groups/${groupId}/game`)
        .set('authorization', owner)
        .send({ startDate: kyivToday, days: 7, openTime: '00:00', mode: 'auto', categories: ['home'] });

      const socket = await TestSocket.connect(app, joined.body.accessToken);
      sockets.push(socket);
      await socket.next((frame) => frame.t === 'ready');
      const subId = socket.subscribe(`group:${groupId}`);
      await socket.next((frame) => frame.t === 'ack' && frame.id === subId && Array.isArray(frame.ok));

      const first = await http().post('/internal/tick').set('authorization', 'Bearer good');
      expect(first.status).toBe(201);
      expect(first.body.advanced).toBeGreaterThanOrEqual(1);
      const event = await socket.next((frame) => frame.t === 'event' && frame.type === 'day.opened');
      expect(event.data).toEqual({ dayIndex: 0 });

      await http().post('/internal/tick').set('authorization', 'Bearer good');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(socket.frames.filter((frame) => frame.t === 'event' && frame.type === 'day.opened')).toHaveLength(1);
    });
  });
});
