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
  });
});
