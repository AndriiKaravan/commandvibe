import { Member, SessionSubject } from '../data/models';

/** Push account of a session: organizers by uid, everyone else by member id. */
export function accountIdOf(subject: SessionSubject): string {
  return subject.kind === 'organizer' ? `o:${subject.id}` : `m:${subject.id}`;
}

/** Accounts that hold the devices of a member; an organizer who plays uses the organizer account. */
export function accountIdsOfMember(member: Member): string[] {
  return member.isOrganizer && member.organizerUid ? [`o:${member.organizerUid}`] : [`m:${member.id}`];
}
