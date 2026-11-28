import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { jpeg } from '../src/photos/testing/fixture-images';
import { FakeFirebase } from './test-app';

const kyivToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

export interface Player {
  auth: string;
  memberId: string;
}

/** Shared setup for e2e specs that need a running game with a few players. */
export function gameFixture(app: INestApplication, firebase: FakeFirebase) {
  const api = () => request(app.getHttpServer());

  async function startedGame(options: { playsToo?: boolean; days?: number } = {}) {
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
      .send({ startDate: kyivToday, days: options.days ?? 7, openTime: '00:00', mode: 'auto', categories: ['home'] })
      .expect(200);
    await api().get(`/groups/${groupId}/today`).set('authorization', owner).expect(200);
    return { owner, groupId, token };
  }

  async function join(token: string, name: string): Promise<Player> {
    const response = await api().post('/join').send({ token, displayName: name });
    return { auth: `Bearer ${response.body.accessToken}`, memberId: response.body.member.id as string };
  }

  async function submit(groupId: string, player: Player, day = 0) {
    const bytes = await jpeg({ width: 800, height: 600 });
    return api()
      .post(`/groups/${groupId}/days/${day}/submission`)
      .set('authorization', player.auth)
      .set('content-type', 'image/jpeg')
      .send(bytes);
  }

  return { api, startedGame, join, submit };
}
