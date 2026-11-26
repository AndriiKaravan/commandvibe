import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SessionService } from '../src/auth/session.service';
import { createTestApp } from './test-app';

describe('AuthController', () => {
  let app: INestApplication;
  let sessions: SessionService;

  beforeAll(async () => {
    app = await createTestApp();
    sessions = app.get(SessionService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('should refuse a protected route without a token', async () => {
    const response = await http().get('/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('token_invalid');
  });

  it('should mark a revoked token as token_invalid so clients know to refresh', async () => {
    const tokens = await sessions.issue({ kind: 'member', id: 'm9', groupId: 'g1' }, 'e2e');
    const { sessionId } = await sessions.verifyAccess(tokens.accessToken);
    await sessions.revoke(sessionId);
    const response = await http().get('/auth/me').set('authorization', `Bearer ${tokens.accessToken}`);
    expect(response.body.code).toBe('token_invalid');
  });

  it('should return the subject for a valid access token', async () => {
    const tokens = await sessions.issue({ kind: 'member', id: 'm1', groupId: 'g1' }, 'e2e');
    const response = await http().get('/auth/me').set('authorization', `Bearer ${tokens.accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ kind: 'member', id: 'm1', groupId: 'g1' });
  });

  it('should exchange a refresh token for a new pair', async () => {
    const tokens = await sessions.issue({ kind: 'member', id: 'm2', groupId: 'g1' }, 'e2e');
    const response = await http().post('/auth/refresh').send({ refreshToken: tokens.refreshToken });
    expect(response.status).toBe(201);
    expect(response.body.refreshToken).not.toBe(tokens.refreshToken);
    expect(typeof response.body.accessToken).toBe('string');
  });

  it('should answer 401 for a reused refresh token', async () => {
    const tokens = await sessions.issue({ kind: 'member', id: 'm3', groupId: 'g1' }, 'e2e');
    await http().post('/auth/refresh').send({ refreshToken: tokens.refreshToken });
    expect((await http().post('/auth/refresh').send({ refreshToken: tokens.refreshToken })).status).toBe(401);
  });

  it('should log out the current session', async () => {
    const tokens = await sessions.issue({ kind: 'member', id: 'm4', groupId: 'g1' }, 'e2e');
    const auth = `Bearer ${tokens.accessToken}`;
    expect((await http().post('/auth/logout').set('authorization', auth)).status).toBe(204);
    expect((await http().get('/auth/me').set('authorization', auth)).status).toBe(401);
  });
});
