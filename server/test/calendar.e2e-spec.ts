import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeFirebase, createTestApp } from './test-app';

/** A start date safely in the future whatever the zone of the group. */
const startDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

describe('Calendar and game setup', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();

  beforeAll(async () => {
    app = await createTestApp({ firebase });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function organizer(): Promise<string> {
    const uid = `org-${Math.random().toString(36).slice(2)}`;
    firebase.users.set(uid, { uid, email: `${uid}@example.com`, name: 'Owner', provider: 'google.com' });
    const signIn = await http().post('/auth/organizer').send({ idToken: uid });
    return `Bearer ${signIn.body.accessToken}`;
  }

  async function groupFor(auth: string): Promise<{ groupId: string; token: string }> {
    const created = await http()
      .post('/groups')
      .set('authorization', auth)
      .send({ name: 'Office', timezone: 'Europe/Kyiv', playsToo: false });
    return { groupId: created.body.group.id, token: (created.body.inviteUrl as string).split('/j/')[1] };
  }

  const setup = (auth: string, groupId: string, body: object = {}) =>
    http()
      .put(`/groups/${groupId}/game`)
      .set('authorization', auth)
      .send({ startDate, days: 7, mode: 'auto', categories: ['home', 'kids'], ...body });

  it('should let the owner set up the game and read the whole calendar', async () => {
    const auth = await organizer();
    const { groupId } = await groupFor(auth);
    const configured = await setup(auth, groupId);
    expect(configured.status).toBe(200);
    expect(configured.body.days).toHaveLength(7);
    const calendar = await http().get(`/groups/${groupId}/calendar`).set('authorization', auth);
    expect(calendar.status).toBe(200);
    expect(calendar.body.game).toMatchObject({ startDate, days: 7, openTime: '09:00', mode: 'auto' });
    expect(calendar.body.days.every((day: { task?: object }) => day.task !== undefined)).toBe(true);
    expect(typeof calendar.body.serverTime).toBe('string');
  });

  it('should show a member the calendar without tasks of closed days', async () => {
    const auth = await organizer();
    const { groupId, token } = await groupFor(auth);
    await setup(auth, groupId);
    const joined = await http().post('/join').send({ token, displayName: 'Ira' });
    const calendar = await http()
      .get(`/groups/${groupId}/calendar`)
      .set('authorization', `Bearer ${joined.body.accessToken}`);
    expect(calendar.status).toBe(200);
    expect(calendar.body.days).toHaveLength(7);
    expect(calendar.body.days.every((day: object) => !('task' in day))).toBe(true);
    expect(JSON.stringify(calendar.body)).not.toMatch(/taskId|"title"|"description"/);
  });

  it('should keep game setup and edits for the owner', async () => {
    const owner = await organizer();
    const other = await organizer();
    const { groupId, token } = await groupFor(owner);
    await setup(owner, groupId);
    const member = (await http().post('/join').send({ token, displayName: 'Ira' })).body.accessToken as string;
    for (const stranger of [other, `Bearer ${member}`]) {
      expect((await setup(stranger, groupId)).status).toBe(403);
      expect(
        (await http().post(`/groups/${groupId}/calendar/days/1/other`).set('authorization', stranger)).status,
      ).toBe(403);
      expect(
        (
          await http()
            .put(`/groups/${groupId}/calendar/days/1/task`)
            .set('authorization', stranger)
            .send({ taskId: 'snowman' })
        ).status,
      ).toBe(403);
      expect(
        (await http().post(`/groups/${groupId}/calendar/days/1/move`).set('authorization', stranger).send({ to: 2 }))
          .status,
      ).toBe(403);
    }
    expect((await http().get(`/groups/${groupId}/calendar`).set('authorization', other)).status).toBe(403);
  });

  it('should refuse unauthenticated calls and bad ids', async () => {
    const auth = await organizer();
    const { groupId } = await groupFor(auth);
    expect((await http().get(`/groups/${groupId}/calendar`)).status).toBe(401);
    expect((await http().get('/groups/not-an-id/calendar').set('authorization', auth)).status).toBe(400);
    expect((await http().post(`/groups/${groupId}/calendar/days/abc/other`).set('authorization', auth)).status).toBe(
      400,
    );
    expect((await http().post(`/groups/${groupId}/calendar/days/99/other`).set('authorization', auth)).status).toBe(
      400,
    );
  });

  it('should map setup errors to 422', async () => {
    const auth = await organizer();
    const { groupId } = await groupFor(auth);
    const bad = await setup(auth, groupId, { days: 3 });
    expect(bad.status).toBe(422);
    expect(bad.body.message).toBe('invalid_days');
    expect((await setup(auth, groupId, { startDate: '2020-01-01' })).body.message).toBe('start_in_past');
  });

  it('should edit days: other, own task, move', async () => {
    const auth = await organizer();
    const { groupId } = await groupFor(auth);
    await setup(auth, groupId, { days: 10 });
    const before = (await http().get(`/groups/${groupId}/calendar`).set('authorization', auth)).body.days;

    const other = await http().post(`/groups/${groupId}/calendar/days/3/other`).set('authorization', auth);
    expect(other.status).toBe(201);
    expect(other.body.task.id).not.toBe(before[3].task.id);

    const own = await http()
      .put(`/groups/${groupId}/calendar/days/4/task`)
      .set('authorization', auth)
      .send({
        custom: { title: { uk: 'Наш кіт' }, description: { uk: 'Кіт у кадрі' } },
      });
    expect(own.status).toBe(200);
    expect(own.body.task).toMatchObject({ custom: true, title: { uk: 'Наш кіт' } });

    const inGame = new Set(before.map((day: { task: { id?: string } }) => day.task.id));
    const catalog = await http().get('/catalog').query({ category: 'winter' }).set('authorization', auth);
    const free = catalog.body.tasks.find((task: { id: string }) => !inGame.has(task.id)).id as string;
    const picked = await http()
      .put(`/groups/${groupId}/calendar/days/5/task`)
      .set('authorization', auth)
      .send({ taskId: free });
    expect(picked.status).toBe(200);
    expect(
      (await http().put(`/groups/${groupId}/calendar/days/6/task`).set('authorization', auth).send({ taskId: free }))
        .status,
    ).toBe(409);
    expect(
      (await http().put(`/groups/${groupId}/calendar/days/6/task`).set('authorization', auth).send({ taskId: 'nope' }))
        .status,
    ).toBe(422);

    const moved = await http()
      .post(`/groups/${groupId}/calendar/days/4/move`)
      .set('authorization', auth)
      .send({ to: 5 });
    expect(moved.status).toBe(201);
    expect(moved.body.days[4].task.id).toBe(free);
    expect(moved.body.days[5].task.custom).toBe(true);
  });

  it('should search the catalog for organizers only', async () => {
    const auth = await organizer();
    const { groupId, token } = await groupFor(auth);
    const found = await http().get('/catalog').query({ category: 'winter', q: 'snowman' }).set('authorization', auth);
    expect(found.status).toBe(200);
    expect(found.body.tasks.map((task: { id: string }) => task.id)).toContain('snowman');
    expect(found.body.tasks.every((task: { categories: string[] }) => task.categories.includes('winter'))).toBe(true);
    expect((await http().get('/catalog').query({ category: 'bogus' }).set('authorization', auth)).status).toBe(400);
    const member = (await http().post('/join').send({ token, displayName: 'Ira' })).body.accessToken as string;
    expect((await http().get('/catalog').set('authorization', `Bearer ${member}`)).status).toBe(403);
    expect((await http().get('/catalog')).status).toBe(401);
    expect(groupId).toBeDefined();
  });
});
