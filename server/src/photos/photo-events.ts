import { Injectable } from '@nestjs/common';
import { groupTopic, ownerTopic } from '../realtime/realtime-access';
import { RealtimeService } from '../shared/realtime';

/** What photos tell the group; payloads never carry links or image content. */
export interface PhotoEvents {
  toGroup(groupId: string, event: string, payload: Record<string, unknown>): void;
  toOwner(groupId: string, event: string, payload: Record<string, unknown>): void;
}

export const PHOTO_EVENTS = Symbol('PhotoEvents');

@Injectable()
export class RealtimePhotoEvents implements PhotoEvents {
  constructor(private readonly realtime: RealtimeService) {}

  toGroup(groupId: string, event: string, payload: Record<string, unknown>): void {
    this.realtime.publish(groupTopic(groupId), event, payload);
  }

  toOwner(groupId: string, event: string, payload: Record<string, unknown>): void {
    this.realtime.publish(ownerTopic(groupId), event, payload);
  }
}
