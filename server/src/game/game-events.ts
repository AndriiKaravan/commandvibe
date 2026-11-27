import { Injectable } from '@nestjs/common';
import { groupTopic } from '../realtime/realtime-access';
import { RealtimeService } from '../shared/realtime';

/** What the game tells the group's members as it happens; payloads never carry task content. */
export interface GameEvents {
  publish(groupId: string, event: string, payload: Record<string, unknown>): void;
}

@Injectable()
export class RealtimeGameEvents implements GameEvents {
  constructor(private readonly realtime: RealtimeService) {}

  publish(groupId: string, event: string, payload: Record<string, unknown>): void {
    this.realtime.publish(groupTopic(groupId), event, payload);
  }
}
