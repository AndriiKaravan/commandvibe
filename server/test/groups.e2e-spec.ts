import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeFirebase, createTestApp } from './test-app';

describe('Organizer sign-in and groups', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();

  beforeAll(async () => {
    app = await createTestApp({ firebase });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function signIn(uid: string): Promise<string> {
    firebase.users.set(`id-${uid}`, { uid, email: `${uid}@example.com`, name: `Name ${uid}`, provider: 'google.com' });
    const response = await http()
      .post('/auth/organizer')
      .send({ idToken: `id-${uid}` });
    expect(response.status).toBe(201);
    return `Bearer ${response.body.accessToken}`;
  }

  it('should refuse an invalid Firebase token', async () => {
    expect((await http().post('/auth/organizer').send({ idToken: 'nope' })).status).toBe(401);
  });

  it('should refuse a provider other than Google or email', async () => {
    firebase.users.set('anon', { uid: 'anon', provider: 'anonymous' });
    expect((await http().post('/auth/organizer').send({ idToken: 'anon' })).status).toBe(403);
  });

  it('should create a group and return an invite link', async () => {
    const auth = await signIn('olena');
    const response = await http()
      .post('/groups')
      .set('authorization', auth)
      .send({ name: 'Office', timezone: 'Europe/Kyiv' });
    expect(response.status).toBe(201);
    expect(response.body.inviteUrl).toMatch(/\/j\/[A-Za-z0-9_-]{22}$/);
    expect(response.body.group).toMatchObject({ name: 'Office', settings: { approveNew: false } });
    expect(response.body.group.inviteTokenHash).toBeUndefined();
  });

  it('should forbid group settings to a non-owner', async () => {
    const owner = await signIn('owner');
    const other = await signIn('other');
    const created = await http()
      .post('/groups')
      .set('authorization', owner)
      .send({ name: 'Family', timezone: 'Europe/Kyiv' });
    const id = created.body.group.id;
    expect((await http().post(`/groups/${id}/invite/rotate`).set('authorization', other)).status).toBe(403);
    expect((await http().get(`/groups/${id}`).set('authorization', other)).status).toBe(403);
    expect((await http().get(`/groups/${id}`).set('authorization', owner)).status).toBe(200);
  });

  it('should list only the groups of the signed-in organizer', async () => {
    const mine = await signIn('lister');
    const other = await signIn('lister-other');
    await http().post('/groups').set('authorization', mine).send({ name: 'Mine', timezone: 'Europe/Kyiv' });
    await http().post('/groups').set('authorization', other).send({ name: 'Theirs', timezone: 'Europe/Kyiv' });
    const response = await http().get('/groups').set('authorization', mine);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ name: 'Mine', status: 'draft', activeMembers: 1 });
    expect(JSON.stringify(response.body)).not.toContain('inviteTokenHash');
    expect(JSON.stringify(response.body)).not.toContain('Theirs');
  });

  it('should return an empty list for an organizer without groups', async () => {
    const response = await http()
      .get('/groups')
      .set('authorization', await signIn('lonely'));
    expect(response.body).toEqual({ items: [] });
  });

  it('should refuse the group list without a session', async () => {
    expect((await http().get('/groups')).status).toBe(401);
  });

  it('should refuse group creation to a member session', async () => {
    const response = await http().post('/groups').send({ name: 'X', timezone: 'Europe/Kyiv' });
    expect(response.status).toBe(401);
  });
});
