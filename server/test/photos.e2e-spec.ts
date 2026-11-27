import { INestApplication } from '@nestjs/common';
import http from 'node:http';
import request from 'supertest';
import { PHOTO_STORE, MemoryPhotoStore } from '../src/photos/photo-store';
import { halvesJpeg, heicHeader, jpeg, padTo } from '../src/photos/testing/fixture-images';
import { FakeFirebase, createTestApp } from './test-app';
import { TestSocket } from './ws-client';

const kyivToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

describe('Photos', () => {
  let app: INestApplication;
  let store: MemoryPhotoStore;
  const firebase = new FakeFirebase();
  const clock = { now: new Date() };
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    app = await createTestApp({ firebase, clock });
    store = app.get(PHOTO_STORE, { strict: false });
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
    clock.now = new Date();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function startedGame(options: { playsToo?: boolean } = {}) {
    const uid = `org-${Math.random().toString(36).slice(2)}`;
    firebase.users.set(uid, { uid, email: `${uid}@example.com`, name: 'Owner', provider: 'google.com' });
    const signIn = await api().post('/auth/organizer').send({ idToken: uid });
    const owner = `Bearer ${signIn.body.accessToken}`;
    const created = await api()
      .post('/groups')
      .set('authorization', owner)
      .send({ name: 'Office', timezone: 'Europe/Kyiv', playsToo: options.playsToo ?? false });
    const groupId = created.body.group.id as string;
    const token = (created.body.inviteUrl as string).split('/j/')[1];
    await api()
      .put(`/groups/${groupId}/game`)
      .set('authorization', owner)
      .send({ startDate: kyivToday, days: 7, openTime: '00:00', mode: 'auto', categories: ['home'] })
      .expect(200);
    await api().get(`/groups/${groupId}/today`).set('authorization', owner).expect(200);
    const calendar = await api().get(`/groups/${groupId}/calendar`).set('authorization', owner);
    const opensAt = new Date(calendar.body.days[0].opensAt as string);
    return { owner, groupId, token, opensAt };
  }

  async function join(token: string, name: string) {
    const response = await api().post('/join').send({ token, displayName: name });
    return {
      auth: `Bearer ${response.body.accessToken}`,
      accessToken: response.body.accessToken as string,
      refreshToken: response.body.refreshToken as string,
      memberId: response.body.member.id as string,
    };
  }

  /** A moved clock expires access tokens, so tests that jump in time sign in again from the refresh token. */
  async function reauth(member: { refreshToken: string }): Promise<string> {
    const response = await api().post('/auth/refresh').send({ refreshToken: member.refreshToken });
    return `Bearer ${response.body.accessToken}`;
  }

  const submit = (groupId: string, auth: string, bytes: Buffer, query = '') =>
    api()
      .post(`/groups/${groupId}/days/0/submission${query}`)
      .set('authorization', auth)
      .set('content-type', 'image/jpeg')
      .send(bytes);

  const list = (groupId: string, auth: string) =>
    api().get(`/groups/${groupId}/days/0/submissions`).set('authorization', auth);

  it('should accept a 19.9 MB photo and keep only metadata-free derived files', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const source = padTo(await jpeg({ width: 4000, height: 3000, gps: true, make: 'SecretCam' }), 19_900_000);
    const response = await submit(groupId, ira.auth, source, '?source=camera');
    expect(response.status).toBe(201);
    expect(store.size).toBe(2);
    expect(JSON.stringify(response.body)).not.toMatch(/GPS|SecretCam|takenAt|source/);
    for (const path of store.paths()) {
      const bytes = (await store.get(path)) as Buffer;
      expect(bytes.includes(Buffer.from('SecretCam'))).toBe(false);
      expect(bytes.includes(Buffer.from('GPS'))).toBe(false);
    }
  });

  it('should refuse a body declared above 20 MB before reading it', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const status = await new Promise<number>((resolve, reject) => {
      const address = app.getHttpServer().address() as { port: number };
      const req = http.request(
        {
          host: '127.0.0.1',
          port: address.port,
          method: 'POST',
          path: `/groups/${groupId}/days/0/submission`,
          headers: { authorization: ira.auth, 'content-type': 'image/jpeg', 'content-length': '20971521' },
        },
        (res) => {
          resolve(res.statusCode ?? 0);
          req.destroy();
        },
      );
      req.on('error', (error) => (req.destroyed ? undefined : reject(error)));
      req.write(Buffer.alloc(1024));
    });
    expect(status).toBe(413);
  });

  it('should stop a chunked body that runs past the limit', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const outcome = await new Promise<number | 'closed'>((resolve) => {
      const address = app.getHttpServer().address() as { port: number };
      const req = http.request(
        {
          host: '127.0.0.1',
          port: address.port,
          method: 'POST',
          path: `/groups/${groupId}/days/0/submission`,
          headers: { authorization: ira.auth, 'content-type': 'image/jpeg', 'transfer-encoding': 'chunked' },
        },
        (res) => {
          resolve(res.statusCode ?? 0);
          req.destroy();
        },
      );
      req.on('error', () => resolve('closed'));
      const chunk = Buffer.alloc(1024 * 1024);
      let sent = 0;
      const push = () => {
        if (req.destroyed || sent >= 22) {
          return;
        }
        sent++;
        req.write(chunk, push);
      };
      push();
    });
    expect([413, 'closed']).toContain(outcome);
    expect(store.paths().filter((p) => p.includes(groupId))).toHaveLength(0);
  });

  it('should refuse heic and non-image content types', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const heic = await submit(groupId, ira.auth, heicHeader());
    expect(heic.status).toBe(415);
    expect(heic.body.message).toBe('heic_unsupported');
    const json = await api()
      .post(`/groups/${groupId}/days/0/submission`)
      .set('authorization', ira.auth)
      .set('content-type', 'application/json')
      .send({ a: 1 });
    expect(json.status).toBe(415);
    const junk = await submit(groupId, ira.auth, Buffer.from('not an image at all'));
    expect(junk.status).toBe(415);
    const broken = await submit(groupId, ira.auth, (await jpeg({ width: 400, height: 300 })).subarray(0, 200));
    expect(broken.status).toBe(422);
  });

  it('should let only one of two parallel uploads win and leave no orphan files', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const before = store.size;
    const photo = await jpeg({ width: 800, height: 600 });
    const [a, b] = await Promise.all([submit(groupId, ira.auth, photo), submit(groupId, ira.auth, photo)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.message).toBe('already_submitted');
    expect(typeof loser.body.version).toBe('string');
    expect(store.size - before).toBe(2);
  });

  it('should replace a photo with the right version, keep submittedAt and drop old files', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const first = await submit(groupId, ira.auth, await jpeg({ width: 800, height: 600 }));
    const before = store.size;
    const replaced = await api()
      .put(`/groups/${groupId}/days/0/submission?replaces=${first.body.version}`)
      .set('authorization', ira.auth)
      .set('content-type', 'image/jpeg')
      .send(await jpeg({ width: 640, height: 480 }));
    expect(replaced.status).toBe(200);
    expect(replaced.body.submittedAt).toBe(first.body.submittedAt);
    expect(replaced.body.version).not.toBe(first.body.version);
    expect(store.size).toBe(before);
    const stale = await api()
      .put(`/groups/${groupId}/days/0/submission?replaces=${first.body.version}`)
      .set('authorization', ira.auth)
      .set('content-type', 'image/jpeg')
      .send(await jpeg({ width: 640, height: 480 }));
    expect(stale.status).toBe(409);
    expect(stale.body.message).toBe('version_mismatch');
  });

  it('should not allow a replacement after the reveal', async () => {
    const { groupId, token, opensAt } = await startedGame();
    const ira = await join(token, 'Ira');
    const first = await submit(groupId, ira.auth, await jpeg({ width: 800, height: 600 }));
    clock.now = new Date(opensAt.getTime() + 58 * 3600_000);
    const late = await api()
      .put(`/groups/${groupId}/days/0/submission?replaces=${first.body.version}`)
      .set('authorization', await reauth(ira))
      .set('content-type', 'image/jpeg')
      .send(await jpeg({ width: 640, height: 480 }));
    expect(late.status).toBe(409);
    expect(late.body.message).toBe('reveal_passed');
  });

  it('should flag a photo taken before the day opened, only for the owner', async () => {
    const { groupId, token, owner } = await startedGame();
    const ira = await join(token, 'Ira');
    const taro = await join(token, 'Taras');
    const openedAt = new Date(clock.now);
    const exif = (at: Date) => {
      const iso = at.toISOString();
      return `${iso.slice(0, 4)}:${iso.slice(5, 7)}:${iso.slice(8, 10)} ${iso.slice(11, 19)}`;
    };
    const early = await jpeg({
      width: 800,
      height: 600,
      dateTimeOriginal: exif(new Date(openedAt.getTime() - 60_000)),
      offset: '+00:00',
    });
    const onTime = await jpeg({
      width: 800,
      height: 600,
      dateTimeOriginal: exif(new Date(openedAt.getTime() + 60_000)),
      offset: '+00:00',
    });
    await submit(groupId, ira.auth, early, '?source=selfie');
    await submit(groupId, taro.auth, onTime, '?source=gallery');
    const asOwner = await list(groupId, owner);
    const byName = (body: { items: { displayName: string; moderation?: unknown }[] }, name: string) =>
      body.items.find((item) => item.displayName === name);
    expect(byName(asOwner.body, 'Ira')?.moderation).toMatchObject({ takenBefore: true, source: 'unknown' });
    expect(byName(asOwner.body, 'Taras')?.moderation).toMatchObject({ takenBefore: false, source: 'gallery' });
    const asMember = await list(groupId, ira.auth);
    expect(JSON.stringify(asMember.body)).not.toMatch(/moderation|takenBefore|takenAt|"source"/);
  });

  it('should record no flag and no takenAt without EXIF', async () => {
    const { groupId, token, owner } = await startedGame();
    const ira = await join(token, 'Ira');
    await submit(groupId, ira.auth, await jpeg({ width: 800, height: 600 }));
    const asOwner = await list(groupId, owner);
    const moderation = asOwner.body.items[0].moderation;
    expect(moderation.takenBefore).toBe(false);
    expect(moderation.takenAt).toBeUndefined();
  });

  it('should refuse closed days, finished games and organizers who do not play', async () => {
    const { groupId, token, owner } = await startedGame();
    const ira = await join(token, 'Ira');
    const closed = await api()
      .post(`/groups/${groupId}/days/3/submission`)
      .set('authorization', ira.auth)
      .set('content-type', 'image/jpeg')
      .send(await jpeg({ width: 100, height: 100 }));
    expect(closed.status).toBe(409);
    expect(closed.body.message).toBe('day_not_open');
    const notPlaying = await submit(groupId, owner, await jpeg({ width: 100, height: 100 }));
    expect(notPlaying.status).toBe(403);
    expect(notPlaying.body.message).toBe('not_playing');
    clock.now = new Date(Date.now() + 40 * 24 * 3600_000);
    const finished = await submit(groupId, await reauth(ira), await jpeg({ width: 100, height: 100 }));
    expect(finished.status).toBe(409);
    expect(finished.body.message).toBe('game_finished');
  });

  it('should blur another photo until the viewer has submitted, then show it in full', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taro = await join(token, 'Taras');
    await submit(groupId, ira.auth, await jpeg({ width: 800, height: 600 }));
    const before = await list(groupId, taro.auth);
    expect(before.body.canSubmit).toBe(true);
    expect(before.body.items[0]).toMatchObject({ displayName: 'Ira', access: 'blur' });
    expect(before.body.items[0].photoUrl).toBeUndefined();
    await submit(groupId, taro.auth, await jpeg({ width: 800, height: 600 }));
    const after = await list(groupId, taro.auth);
    expect(after.body.canSubmit).toBe(false);
    expect(after.body.mine).toMatchObject({ displayName: 'Taras', access: 'full', mine: true });
    expect(after.body.items[0]).toMatchObject({ displayName: 'Ira', access: 'full' });
    expect(after.body.total).toBe(2);
  });

  describe('reveal', () => {
    it('should tell clients when an open day is revealed', async () => {
      const { groupId, owner, opensAt } = await startedGame();
      const today = await api().get(`/groups/${groupId}/today`).set('authorization', owner);
      const calendar = await api().get(`/groups/${groupId}/calendar`).set('authorization', owner);
      for (const day of [today.body.day, calendar.body.days[0]]) {
        const reveal = new Date(day.revealAt as string);
        expect(reveal.getTime() - opensAt.getTime()).toBeGreaterThan(2 * 24 * 3600_000);
        expect(reveal.getTime() - opensAt.getTime()).toBeLessThan(3 * 24 * 3600_000);
      }
      expect(calendar.body.days[1].revealAt).toBeUndefined();
    });

    it('should show everything in full after 9:00 without waiting for any tick', async () => {
      const { groupId, token, opensAt } = await startedGame();
      const ira = await join(token, 'Ira');
      const taro = await join(token, 'Taras');
      await submit(groupId, ira.auth, await jpeg({ width: 800, height: 600 }));
      const before = await list(groupId, taro.auth);
      expect(before.body.items[0].access).toBe('blur');
      expect(before.body.revealed).toBe(false);
      clock.now = new Date(opensAt.getTime() + 58 * 3600_000);
      const after = await list(groupId, await reauth(taro));
      expect(after.body.revealed).toBe(true);
      expect(after.body.items[0]).toMatchObject({ displayName: 'Ira', access: 'full' });
      expect(after.body.items[0].photoUrl).toBeDefined();
    });
  });

  describe('files', () => {
    async function twoPhotos() {
      const world = await startedGame();
      const ira = await join(world.token, 'Ira');
      const taro = await join(world.token, 'Taras');
      await submit(world.groupId, ira.auth, await halvesJpeg(800, 600));
      return { ...world, ira, taro };
    }

    it('should serve a blur link with safe headers and refuse the full photo of the same author', async () => {
      const { groupId, taro } = await twoPhotos();
      const view = (await list(groupId, taro.auth)).body.items[0];
      const blur = await api().get(view.blurUrl).set('origin', 'http://localhost:3000');
      expect(blur.status).toBe(200);
      expect(blur.headers['content-type']).toBe('image/jpeg');
      expect(blur.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
      expect(blur.headers['referrer-policy']).toBe('no-referrer');
      expect(blur.headers['x-content-type-options']).toBe('nosniff');
      expect((view.blurUrl as string).startsWith('/p/')).toBe(true);
    });

    it('should give the author a full link and other members only blur links', async () => {
      const { groupId, ira, taro } = await twoPhotos();
      const own = (await list(groupId, ira.auth)).body.mine;
      // The link names its viewer: it is a link for Ira, and Ira's own blur is not an access Taras holds.
      expect((await api().get(own.photoUrl)).status).toBe(200);
      const blurByTaro = (await list(groupId, taro.auth)).body.items[0].blurUrl;
      expect((await api().get(blurByTaro)).status).toBe(200);
    });

    it('should expire links and reject tampered ones', async () => {
      const { groupId, taro } = await twoPhotos();
      const url = (await list(groupId, taro.auth)).body.items[0].blurUrl as string;
      expect((await api().get(url)).status).toBe(200);
      expect((await api().get(`${url}x`)).status).toBe(404);
      expect((await api().get('/p/garbage')).status).toBe(404);
      clock.now = new Date(clock.now.getTime() + 11 * 60_000);
      expect((await api().get(url)).status).toBe(404);
    });
  });

  it('should tell group members about a new photo without any link or content', async () => {
    const { groupId, token } = await startedGame();
    const ira = await join(token, 'Ira');
    const taro = await join(token, 'Taras');
    const socket = await TestSocket.connect(app, taro.accessToken);
    sockets.push(socket);
    await socket.next((frame) => frame.t === 'ready');
    const id = socket.subscribe(`group:${groupId}`);
    await socket.next((frame) => frame.t === 'ack' && frame.id === id && Array.isArray(frame.ok));
    await submit(groupId, ira.auth, await jpeg({ width: 800, height: 600 }));
    const event = await socket.next((frame) => frame.t === 'event' && frame.type === 'submission.created');
    expect(event.data).toEqual({ dayIndex: 0, memberId: ira.memberId });
    expect(JSON.stringify(event)).not.toMatch(/url|photo|blur/i);
  });
});
