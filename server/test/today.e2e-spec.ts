import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeFirebase, createTestApp } from './test-app';
import { TestSocket } from './ws-client';

/** Today in Kyiv, so a game started "today at 00:00" has already opened its first day. */
const kyivToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

describe('Today and roulette', () => {
  let app: INestApplication;
  const firebase = new FakeFirebase();
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    app = await createTestApp({ firebase });
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function startedGame(mode: 'auto' | 'roulette') {
    const uid = `org-${Math.random().toString(36).slice(2)}`;
    firebase.users.set(uid, { uid, email: `${uid}@example.com`, name: 'Owner', provider: 'google.com' });
    const signIn = await http().post('/auth/organizer').send({ idToken: uid });
    const owner = `Bearer ${signIn.body.accessToken}`;
    const created = await http()
      .post('/groups')
      .set('authorization', owner)
      .send({ name: 'Office', timezone: 'Europe/Kyiv', playsToo: false });
    const groupId = created.body.group.id as string;
    const token = (created.body.inviteUrl as string).split('/j/')[1];
    const configured = await http()
      .put(`/groups/${groupId}/game`)
      .set('authorization', owner)
      .send({ startDate: kyivToday, days: 7, openTime: '00:00', mode, categories: ['home'] });
    expect(configured.status).toBe(200);
    return { owner, groupId, token };
  }

  async function join(token: string, name: string) {
    const response = await http().post('/join').send({ token, displayName: name });
    return {
      auth: `Bearer ${response.body.accessToken}`,
      accessToken: response.body.accessToken as string,
      memberId: response.body.member.id as string,
    };
  }

  async function listen(accessToken: string, groupId: string): Promise<TestSocket> {
    const socket = await TestSocket.connect(app, accessToken);
    sockets.push(socket);
    await socket.next((frame) => frame.t === 'ready');
    const id = socket.subscribe(`group:${groupId}`);
    await socket.next((frame) => frame.t === 'ack' && frame.id === id && Array.isArray(frame.ok));
    return socket;
  }

  it('should open the first day in auto mode and show every member the same task', async () => {
    const { owner, groupId, token } = await startedGame('auto');
    const first = await join(token, 'Ira');
    const second = await join(token, 'Taras');
    const a = await http().get(`/groups/${groupId}/today`).set('authorization', first.auth);
    const b = await http().get(`/groups/${groupId}/today`).set('authorization', second.auth);
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ status: 'active', day: { dayIndex: 0, state: 'open' } });
    expect(a.body.day.task).toBeDefined();
    expect(b.body.day.task).toEqual(a.body.day.task);
    const ownerView = await http().get(`/groups/${groupId}/today`).set('authorization', owner);
    expect(ownerView.body.day.task).toEqual(a.body.day.task);
  });

  it('should refuse today to someone outside the group', async () => {
    const { groupId } = await startedGame('auto');
    const other = await startedGame('auto');
    const stranger = await join(other.token, 'Olena');
    expect((await http().get(`/groups/${groupId}/today`).set('authorization', stranger.auth)).status).toBe(403);
    expect((await http().get(`/groups/${groupId}/today`)).status).toBe(401);
  });

  it('should send the same roulette spin to every member and show the task only after it', async () => {
    const { groupId, token } = await startedGame('roulette');
    const members = [await join(token, 'Ira'), await join(token, 'Taras')];
    const listeners = await Promise.all(members.map((member) => listen(member.accessToken, groupId)));

    const today = await http().get(`/groups/${groupId}/today`).set('authorization', members[0].auth);
    expect(today.body.day).toMatchObject({ state: 'picking' });
    expect(today.body.day).not.toHaveProperty('task');
    const picker = members.find((member) => member.memberId === today.body.day.pickerMemberId)!;
    const bystander = members.find((member) => member !== picker)!;
    await listeners[0].next((frame) => frame.t === 'event' && frame.type === 'roulette.waiting');

    expect((await http().post(`/groups/${groupId}/roulette/spin`).set('authorization', bystander.auth)).status).toBe(
      403,
    );
    expect((await http().post(`/groups/${groupId}/roulette/spin`).set('authorization', picker.auth)).status).toBe(204);

    const events = await Promise.all(
      listeners.map((socket) => socket.next((frame) => frame.t === 'event' && frame.type === 'roulette.spin')),
    );
    expect(events[0].data).toEqual(events[1].data);
    expect(events[0].data).toMatchObject({ dayIndex: 0, durationMs: 5000, by: 'member' });
    expect(JSON.stringify(events[0].data)).not.toMatch(/taskId|title|description/);

    const during = await http().get(`/groups/${groupId}/today`).set('authorization', bystander.auth);
    expect(during.body.day).toMatchObject({ state: 'open', spin: { by: 'member' } });
    expect(during.body.day).not.toHaveProperty('task');
    expect((await http().post(`/groups/${groupId}/roulette/spin`).set('authorization', picker.auth)).status).toBe(409);
  });
});
