import { Member } from '../data/models';
import { accountIdOf, accountIdsOfMember } from './push-account';

const member = (overrides: Partial<Member>): Member => ({
  id: 'm1',
  groupId: 'g',
  displayName: 'A',
  nameKey: 'a',
  status: 'active',
  isOrganizer: false,
  createdAt: new Date(),
  ...overrides,
});

describe('push accounts', () => {
  it('should key an organizer session by uid and a member session by member id', () => {
    expect(accountIdOf({ kind: 'organizer', id: 'u1' })).toBe('o:u1');
    expect(accountIdOf({ kind: 'member', id: 'm1', groupId: 'g' })).toBe('m:m1');
  });

  it('should send a playing organizer’s notifications to the organizer account', () => {
    expect(accountIdsOfMember(member({ isOrganizer: true, organizerUid: 'u1' }))).toEqual(['o:u1']);
  });

  it('should send an ordinary member’s notifications to the member account', () => {
    expect(accountIdsOfMember(member({}))).toEqual(['m:m1']);
  });
});
