import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PHOTO_STORE, MemoryPhotoStore } from '../src/photos/photo-store';
import { PhotoUrlSigner } from '../src/photos/photo-url';
import { PHOTO_URL_SIGNER } from '../src/photos/photo-url.token';
import { jpeg } from '../src/photos/testing/fixture-images';
import { FakeFirebase, createTestApp } from './test-app';

const kyivToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

describe('Photo moderation', () => {
  let app: INestApplication;
  let store: MemoryPhotoStore;
  let signer: PhotoUrlSigner;
  const firebase = new FakeFirebase();
  const clock = { now: new Date() };

  beforeAll(async () => {
    app = await createTestApp({ firebase, clock });
    store = app.get(PHOTO_STORE, { strict: false });
    signer = app.get(PHOTO_URL_SIGNER, { strict: false });
  });

  afterEach(() => {
    clock.now = new Date();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function world() {
    const uid = `org-${Math.random().toString(36).slice(2)}`;
    firebase.users.set(uid, { uid, email: `${uid}@example.com`, name: 'Owner', provider: 'google.com' });
    const signIn = await api().post('/auth/organizer').send({ idToken: uid });
    const owner = `Bearer ${signIn.body.accessToken}`;
    const created = await api()
      .post('/groups')
      .set('authorization', owner)
      .send({ name: 'Office', timezone: 'Europe/Kyiv', playsToo: false });
    const groupId = created.body.group.id as string;
    const token = (created.body.inviteUrl as string).split('/j/')[1];
    await api()
      .put(`/groups/${groupId}/game`)
      .set('authorization', owner)
      .send({ startDate: kyivToday, days: 7, openTime: '00:00', mode: 'auto', categories: ['home'] })
      .expect(200);
    await api().get(`/groups/${groupId}/today`).set('authorization', owner).expect(200);
    const join = async (name: string) => {
      const response = await api().post('/join').send({ token, displayName: name });
      return { auth: `Bearer ${response.body.accessToken}`, memberId: response.body.member.id as string };
    };
    const ira = await join('Ira');
    const taro = await join('Taras');
    return { groupId, owner, ira, taro };
  }

  const submit = async (groupId: string, auth: string) =>
    api()
      .post(`/groups/${groupId}/days/0/submission`)
      .set('authorization', auth)
      .set('content-type', 'image/jpeg')
      .send(await jpeg({ width: 800, height: 600 }));

  const list = (groupId: string, auth: string) =>
    api().get(`/groups/${groupId}/days/0/submissions`).set('authorization', auth);

  const complain = (groupId: string, auth: string, authorId: string, body: object = {}) =>
    api().post(`/groups/${groupId}/days/0/submissions/${authorId}/complaints`).set('authorization', auth).send(body);

  const hide = (groupId: string, auth: string, authorId: string, hidden: boolean) =>
    api().put(`/groups/${groupId}/days/0/submissions/${authorId}/hidden`).set('authorization', auth).send({ hidden });

  it('should refuse a complaint about a blurred photo and about your own', async () => {
    const { groupId, ira, taro } = await world();
    await submit(groupId, ira.auth);
    expect((await complain(groupId, taro.auth, ira.memberId)).status).toBe(403);
    await submit(groupId, taro.auth);
    expect((await complain(groupId, taro.auth, taro.memberId)).status).toBe(422);
    expect((await complain(groupId, taro.auth, 'a'.repeat(20))).status).toBe(404);
  });

  it('should keep one complaint per complainer and tell only the owner who complained', async () => {
    const { groupId, owner, ira, taro } = await world();
    await submit(groupId, ira.auth);
    await submit(groupId, taro.auth);
    expect((await complain(groupId, taro.auth, ira.memberId, { reason: 'inappropriate' })).status).toBe(204);
    expect((await complain(groupId, taro.auth, ira.memberId, { reason: 'other' })).status).toBe(204);
    const asOwner = await api().get(`/groups/${groupId}/complaints`).set('authorization', owner);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.items).toHaveLength(1);
    expect(asOwner.body.items[0]).toMatchObject({
      dayIndex: 0,
      memberId: ira.memberId,
      displayName: 'Ira',
      reasons: { inappropriate: 1, not_task: 0, other: 0 },
      complainers: [{ memberId: taro.memberId, displayName: 'Taras' }],
      hidden: false,
    });
    const asMember = await api().get(`/groups/${groupId}/complaints`).set('authorization', taro.auth);
    expect(asMember.status).toBe(403);
    expect(JSON.stringify((await list(groupId, taro.auth)).body)).not.toMatch(/complainers/);
  });

  it('should open a complained photo to an owner who does not play', async () => {
    const { groupId, owner, ira, taro } = await world();
    await submit(groupId, ira.auth);
    await submit(groupId, taro.auth);
    const before = (await list(groupId, owner)).body.items.find(
      (i: { memberId: string }) => i.memberId === ira.memberId,
    );
    expect(before.access).toBe('blur');
    await complain(groupId, taro.auth, ira.memberId);
    const after = (await list(groupId, owner)).body.items.find(
      (i: { memberId: string }) => i.memberId === ira.memberId,
    );
    expect(after.access).toBe('full');
    expect(after.moderation.openComplaints).toBe(1);
    expect((await api().get(after.photoUrl)).status).toBe(200);
  });

  it('should hide a photo from members, keep it for the author, and kill links issued before', async () => {
    const { groupId, owner, ira, taro } = await world();
    await submit(groupId, ira.auth);
    await submit(groupId, taro.auth);
    const seen = (await list(groupId, taro.auth)).body.items[0];
    expect((await api().get(seen.photoUrl)).status).toBe(200);
    expect((await hide(groupId, taro.auth, ira.memberId, true)).status).toBe(403);
    expect((await hide(groupId, owner, ira.memberId, true)).status).toBe(204);
    expect((await list(groupId, taro.auth)).body.items).toHaveLength(0);
    expect((await api().get(seen.photoUrl)).status).toBe(404);
    expect((await api().get(seen.blurUrl)).status).toBe(404);
    const mine = (await list(groupId, ira.auth)).body.mine;
    expect(mine).toMatchObject({ status: 'hidden', access: 'full' });
    const ownerItem = (await list(groupId, owner)).body.items.find(
      (i: { memberId: string }) => i.memberId === ira.memberId,
    );
    expect(ownerItem).toBeDefined();
    expect((await hide(groupId, owner, ira.memberId, false)).status).toBe(204);
    const again = (await list(groupId, taro.auth)).body.items[0];
    expect((await api().get(again.photoUrl)).status).toBe(200);
  });

  it('should not unblur a hidden photo for the owner', async () => {
    const { groupId, owner, ira } = await world();
    await submit(groupId, ira.auth);
    await hide(groupId, owner, ira.memberId, true);
    await hide(groupId, owner, ira.memberId, false);
    const view = (await list(groupId, owner)).body.items[0];
    expect(view.access).toBe('blur');
    expect(view.photoUrl).toBeUndefined();
  });

  it('should close complaints when the owner hides or dismisses', async () => {
    const { groupId, owner, ira, taro } = await world();
    await submit(groupId, ira.auth);
    await submit(groupId, taro.auth);
    await complain(groupId, taro.auth, ira.memberId);
    await hide(groupId, owner, ira.memberId, true);
    expect((await api().get(`/groups/${groupId}/complaints`).set('authorization', owner)).body.items).toHaveLength(0);
    await hide(groupId, owner, ira.memberId, false);
    await complain(groupId, taro.auth, ira.memberId);
    const dismissed = await api()
      .post(`/groups/${groupId}/days/0/submissions/${ira.memberId}/complaints/dismiss`)
      .set('authorization', owner);
    expect(dismissed.status).toBe(204);
    expect((await api().get(`/groups/${groupId}/complaints`).set('authorization', owner)).body.items).toHaveLength(0);
  });

  it('should refuse a forged link that asks for the full photo of a blurred one', async () => {
    const { groupId, ira, taro } = await world();
    await submit(groupId, ira.auth);
    const forged = signer.sign(
      {
        g: groupId,
        d: 0,
        a: ira.memberId,
        v: (await list(groupId, ira.auth)).body.mine.version,
        x: 'photo',
        k: 'member',
        s: taro.memberId,
      },
      clock.now,
    );
    expect((await api().get(forged)).status).toBe(404);
  });

  it('should delete a removed member data and kill their links', async () => {
    const { groupId, owner, ira, taro } = await world();
    await submit(groupId, ira.auth);
    await submit(groupId, taro.auth);
    await complain(groupId, taro.auth, ira.memberId);
    const iraLinks = (await list(groupId, ira.auth)).body.items[0];
    const taroSeesIra = (await list(groupId, taro.auth)).body.items[0];
    const filesBefore = store.paths().filter((p) => p.startsWith(`groups/${groupId}/`)).length;
    expect(filesBefore).toBe(4);
    const removed = await api().post(`/groups/${groupId}/members/${ira.memberId}/remove`).set('authorization', owner);
    expect(removed.status).toBe(204);
    expect(store.paths().filter((p) => p.includes(`/${ira.memberId}/`))).toHaveLength(0);
    const rest = await list(groupId, taro.auth);
    expect(rest.body.items).toHaveLength(0);
    expect(rest.body.total).toBe(1);
    expect((await api().get(taroSeesIra.blurUrl)).status).toBe(404);
    expect((await api().get(`/groups/${groupId}/complaints`).set('authorization', owner)).body.items).toHaveLength(0);
    expect(iraLinks).toBeDefined();
  });

  it('should refuse a link issued to a viewer who was removed since', async () => {
    const { groupId, owner, ira, taro } = await world();
    await submit(groupId, ira.auth);
    const link = (await list(groupId, taro.auth)).body.items[0].blurUrl as string;
    expect((await api().get(link)).status).toBe(200);
    await api().post(`/groups/${groupId}/members/${taro.memberId}/remove`).set('authorization', owner).expect(204);
    expect((await api().get(link)).status).toBe(404);
  });
  it('should hear a new complaint after the old one was dismissed, and drop complaints when the photo is replaced', async () => {
    const { groupId, owner, ira, taro } = await world();
    const first = await submit(groupId, ira.auth);
    await submit(groupId, taro.auth);
    await complain(groupId, taro.auth, ira.memberId);
    await api()
      .post(`/groups/${groupId}/days/0/submissions/${ira.memberId}/complaints/dismiss`)
      .set('authorization', owner);
    await complain(groupId, taro.auth, ira.memberId);
    const listed = () => api().get(`/groups/${groupId}/complaints`).set('authorization', owner);
    expect((await listed()).body.items).toHaveLength(1);
    await api()
      .put(`/groups/${groupId}/days/0/submission?replaces=${first.body.version}`)
      .set('authorization', ira.auth)
      .set('content-type', 'image/jpeg')
      .send(await jpeg({ width: 640, height: 480 }))
      .expect(200);
    expect((await listed()).body.items).toHaveLength(0);
  });

  it('should refuse a hidden flag that is not a boolean', async () => {
    const { groupId, owner, ira } = await world();
    await submit(groupId, ira.auth);
    const bad = await api()
      .put(`/groups/${groupId}/days/0/submissions/${ira.memberId}/hidden`)
      .set('authorization', owner)
      .send({ hidden: 'true' });
    expect(bad.status).toBe(400);
  });

  it('should not keep the photo of a member removed while the upload was being processed', async () => {
    const { groupId, owner, ira } = await world();
    const original = store.put.bind(store);
    let removed = false;
    store.put = async (path: string, bytes: Buffer) => {
      if (!removed) {
        removed = true;
        await api().post(`/groups/${groupId}/members/${ira.memberId}/remove`).set('authorization', owner).expect(204);
      }
      return original(path, bytes);
    };
    try {
      const response = await submit(groupId, ira.auth);
      expect([401, 403]).toContain(response.status);
    } finally {
      store.put = original;
    }
    expect(store.paths().filter((p) => p.includes(`/${ira.memberId}/`))).toHaveLength(0);
    const asOwner = await list(groupId, owner);
    expect(asOwner.body.items).toHaveLength(0);
  });
});
