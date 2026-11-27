import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Test seed endpoint', () => {
  it('should not exist unless the app runs in test mode', async () => {
    const app = await createTestApp();
    expect((await request(app.getHttpServer()).post('/test/seed-group').send({})).status).toBe(404);
    await app.close();
  });

  describe('in test mode', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp({ testSeed: true });
    });

    afterAll(async () => {
      await app.close();
    });

    it('should create a group whose invite works', async () => {
      const seeded = await request(app.getHttpServer()).post('/test/seed-group').send({ name: 'Seeded' });
      expect(seeded.status).toBe(201);
      const preview = await request(app.getHttpServer()).get(`/join/${seeded.body.token}`);
      expect(preview.body).toMatchObject({ groupName: 'Seeded', memberCount: 0 });
      expect(typeof seeded.body.groupId).toBe('string');
    });

    it('should start a game today when asked, so a member sees a task at once', async () => {
      const seeded = await request(app.getHttpServer())
        .post('/test/seed-group')
        .send({ game: { mode: 'auto' } });
      const joined = await request(app.getHttpServer())
        .post('/join')
        .send({ token: seeded.body.token, displayName: 'Ira' });
      const today = await request(app.getHttpServer())
        .get(`/groups/${seeded.body.groupId}/today`)
        .set('authorization', `Bearer ${joined.body.accessToken}`);
      expect(today.body).toMatchObject({ status: 'active', day: { dayIndex: 0, state: 'open' } });
      expect(today.body.day.task).toBeDefined();
    });

    it('should start a roulette game on request', async () => {
      const seeded = await request(app.getHttpServer())
        .post('/test/seed-group')
        .send({ game: { mode: 'roulette' } });
      const joined = await request(app.getHttpServer())
        .post('/join')
        .send({ token: seeded.body.token, displayName: 'Ira' });
      const today = await request(app.getHttpServer())
        .get(`/groups/${seeded.body.groupId}/today`)
        .set('authorization', `Bearer ${joined.body.accessToken}`);
      expect(today.body.day).toMatchObject({ state: 'picking', isMyTurn: true });
    });
  });
});
