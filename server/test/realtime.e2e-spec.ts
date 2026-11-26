import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeFirebase, createTestApp } from './test-app';
import { TestSocket } from './ws-client';

describe('Group realtime', () => {
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

  async function groupWith(approveNew = false) {
    const uid = `org-${Math.random().toString(36).slice(2)}`;
    firebase.users.set(uid, { uid, email: `${uid}@example.com`, name: 'Owner', provider: 'google.com' });
    const signIn = await http().post('/auth/organizer').send({ idToken: uid });
    const ownerToken = signIn.body.accessToken as string;
    const created = await http()
      .post('/groups')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Office', timezone: 'Europe/Kyiv', playsToo: false, approveNew });
    return {
      ownerToken,
      groupId: created.body.group.id as string,
      token: (created.body.inviteUrl as string).split('/j/')[1],
    };
  }

  async function join(token: string, name: string) {
    const response = await http().post('/join').send({ token, displayName: name });
    return { accessToken: response.body.accessToken as string, memberId: response.body.member.id as string };
  }

  async function socketFor(accessToken: string): Promise<TestSocket> {
    const socket = await TestSocket.connect(app, accessToken);
    sockets.push(socket);
    await socket.next((f) => f.t === 'ready');
    return socket;
  }

  it('should deliver member.joined to members of the group', async () => {
    const { groupId, token } = await groupWith();
    const olena = await join(token, 'Olena');
    const socket = await socketFor(olena.accessToken);
    const subId = socket.subscribe(`group:${groupId}`);
    await socket.next((f) => f.t === 'ack' && f.id === subId && Array.isArray(f.ok));
    const taras = await join(token, 'Taras');
    const event = await socket.next((f) => f.t === 'event' && f.type === 'member.joined');
    expect(event).toMatchObject({ topic: `group:${groupId}`, data: { memberId: taras.memberId } });
  });

  it('should tell only the owner about a pending member', async () => {
    const { ownerToken, groupId, token } = await groupWith(true);
    const owner = await socketFor(ownerToken);
    const subId = owner.subscribe(`org:${groupId}`);
    await owner.next((f) => f.t === 'ack' && f.id === subId && Array.isArray(f.ok));
    const olena = await join(token, 'Olena');
    const event = await owner.next((f) => f.t === 'event' && f.type === 'member.pending');
    expect(event.data).toEqual({ memberId: olena.memberId });
  });

  it('should deny group topic to a pending member', async () => {
    const { groupId, token } = await groupWith(true);
    const olena = await join(token, 'Olena');
    const socket = await socketFor(olena.accessToken);
    const subId = socket.subscribe(`group:${groupId}`);
    const ack = await socket.next((f) => f.t === 'ack' && f.id === subId);
    expect(ack.denied).toEqual([{ topic: `group:${groupId}`, reason: 'forbidden' }]);
  });

  it("should deny another group's topic and the owner topic to a member", async () => {
    const first = await groupWith();
    const second = await groupWith();
    const olena = await join(first.token, 'Olena');
    const socket = await socketFor(olena.accessToken);
    const subId = socket.subscribe(`group:${second.groupId}`);
    expect((await socket.next((f) => f.t === 'ack' && f.id === subId)).denied).toBeDefined();
    const orgId = socket.subscribe(`org:${first.groupId}`);
    expect((await socket.next((f) => f.t === 'ack' && f.id === orgId)).denied).toBeDefined();
  });

  it('should tell a pending member about the approval on their own topic', async () => {
    const { ownerToken, groupId, token } = await groupWith(true);
    const olena = await join(token, 'Olena');
    const socket = await socketFor(olena.accessToken);
    const subId = socket.subscribe(`member:${olena.memberId}`);
    await socket.next((f) => f.t === 'ack' && f.id === subId && Array.isArray(f.ok));
    await http()
      .post(`/groups/${groupId}/members/${olena.memberId}/approve`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(204);
    const event = await socket.next((f) => f.t === 'event' && f.type === 'member.approved');
    expect(event.topic).toBe(`member:${olena.memberId}`);
  });

  it("should deny someone else's personal topic", async () => {
    const { token } = await groupWith();
    const olena = await join(token, 'Olena');
    const taras = await join(token, 'Taras');
    const socket = await socketFor(olena.accessToken);
    const subId = socket.subscribe(`member:${taras.memberId}`);
    expect((await socket.next((f) => f.t === 'ack' && f.id === subId)).denied).toBeDefined();
  });

  it("should close the removed member's socket with 4403", async () => {
    const { ownerToken, groupId, token } = await groupWith();
    const olena = await join(token, 'Olena');
    const socket = await socketFor(olena.accessToken);
    await http()
      .post(`/groups/${groupId}/members/${olena.memberId}/remove`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(204);
    expect(await socket.closed()).toBe(4403);
  });

  it('should refuse a socket with an unknown token', async () => {
    const socket = await TestSocket.connect(app, 'garbage');
    sockets.push(socket);
    expect(await socket.closed()).toBe(4401);
  });
});
