import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SessionService } from '../src/auth/session.service';
import { createTestApp } from './test-app';

describe('App Check guard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ appCheckMode: 'enforce' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject a signed-in request without an App Check token in enforce mode', async () => {
    const tokens = await app.get(SessionService).issue({ kind: 'member', id: 'm1', groupId: 'g1' }, 'e2e');
    const response = await request(app.getHttpServer()).get('/auth/me').set('authorization', `Bearer ${tokens.accessToken}`);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('APP_CHECK_FAILED');
  });

  it('should leave public routes alone', async () => {
    expect((await request(app.getHttpServer()).get('/health')).status).toBe(200);
  });
});
