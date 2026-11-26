import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeFirebase, createTestApp } from './test-app';

describe('Join by group link', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();

  beforeAll(async () => {
    app = await createTestApp({ firebase });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function organizerWithGroup(name = 'Office <script>"&') {
    const uid = `org-${Math.random().toString(36).slice(2)}`;
    firebase.users.set(uid, { uid, email: `${uid}@example.com`, name: 'Owner', provider: 'google.com' });
    const signIn = await http().post('/auth/organizer').send({ idToken: uid });
    const auth = `Bearer ${signIn.body.accessToken}`;
    const created = await http().post('/groups').set('authorization', auth).send({ name, timezone: 'Europe/Kyiv', playsToo: false });
    return { auth, groupId: created.body.group.id as string, token: (created.body.inviteUrl as string).split('/j/')[1] };
  }

  it('should preview the group for a valid link', async () => {
    const { token } = await organizerWithGroup('Family');
    const response = await http().get(`/join/${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ groupName: 'Family', memberCount: 0, approveNew: false });
  });

  it('should join, set a PIN and come back from another device', async () => {
    const { token } = await organizerWithGroup();
    const joined = await http().post('/join').send({ token, displayName: 'Olena' });
    expect(joined.status).toBe(201);
    expect(joined.body.member).toMatchObject({ displayName: 'Olena', status: 'active' });
    const pin = await http().put('/me/pin').set('authorization', `Bearer ${joined.body.accessToken}`).send({ pin: '4321' });
    expect(pin.status).toBe(204);
    const back = await http().post('/join/returning').send({ token, displayName: 'olena', pin: '4321' });
    expect(back.status).toBe(201);
    expect(back.body.member.id).toBe(joined.body.member.id);
  });

  it('should map errors to 409, 410 and 422', async () => {
    const { auth, groupId, token } = await organizerWithGroup();
    await http().post('/join').send({ token, displayName: 'Olena' });
    expect((await http().post('/join').send({ token, displayName: 'OLENA' })).status).toBe(409);
    expect((await http().post('/join').send({ token, displayName: '' })).status).toBe(422);
    await http().post(`/groups/${groupId}/invite/rotate`).set('authorization', auth);
    expect((await http().post('/join').send({ token, displayName: 'Taras' })).status).toBe(410);
  });

  it('should let the organizer remove a member and end their session', async () => {
    const { auth, groupId, token } = await organizerWithGroup();
    const joined = await http().post('/join').send({ token, displayName: 'Olena' });
    const memberAuth = `Bearer ${joined.body.accessToken}`;
    expect((await http().get(`/groups/${groupId}`).set('authorization', memberAuth)).status).toBe(200);
    const removed = await http().post(`/groups/${groupId}/members/${joined.body.member.id}/remove`).set('authorization', auth);
    expect(removed.status).toBe(204);
    expect((await http().get(`/groups/${groupId}`).set('authorization', memberAuth)).status).toBe(401);
  });

  it('should refuse ids that are not ours before they reach a database path', async () => {
    const { auth, groupId } = await organizerWithGroup();
    expect((await http().get('/groups/..%2Fsessions').set('authorization', auth)).status).toBe(400);
    expect((await http().post(`/groups/${groupId}/members/m%2Fprivate%2Fsecrets/remove`).set('authorization', auth)).status).toBe(400);
  });

  it('should list members to the owner with pending ones', async () => {
    const { auth, groupId, token } = await organizerWithGroup();
    await http().post('/join').send({ token, displayName: 'Olena' });
    const list = await http().get(`/groups/${groupId}/members`).set('authorization', auth);
    expect(list.status).toBe(200);
    expect(list.body.map((m: { displayName: string }) => m.displayName)).toEqual(['Olena']);
  });

  describe('invite page', () => {
    it('should put the escaped group name into og:title', async () => {
      const { token } = await organizerWithGroup('Office <script>"&');
      const response = await http().get(`/j/${token}`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).toContain('Office &lt;script&gt;&quot;&amp;');
      expect(response.text).not.toContain('<script>"&');
      expect(response.text).toContain('<meta name="robots" content="noindex">');
      expect(response.text).toContain(`/join?t=${token}`);
    });

    it('should answer 410 without the group name for a closed invite', async () => {
      const { auth, groupId, token } = await organizerWithGroup('Secret club');
      await http().post(`/groups/${groupId}/invite/close`).set('authorization', auth);
      const response = await http().get(`/j/${token}`);
      expect(response.status).toBe(410);
      expect(response.text).not.toContain('Secret club');
      expect(response.text).toContain('Посилання більше не діє');
    });
  });
});
