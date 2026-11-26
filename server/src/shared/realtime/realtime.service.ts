// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Server } from 'node:http';
import { RealtimeHub } from './realtime-hub';
import { REALTIME_HUB } from './realtime.tokens';
import { attachRealtime } from './upgrade';

/** What backend services use to push events; never throws, never waits for the network. */
@Injectable()
export class RealtimeService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private detach?: () => void;

  constructor(
    @Inject(REALTIME_HUB) private readonly hub: RealtimeHub,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  publish(
    topic: string,
    type: string,
    data: unknown,
    opts?: { exceptUserId?: string; exceptSession?: { sid: string; userId: string } },
  ): void {
    this.hub.publish(topic, type, data, opts);
  }

  /** Revokes every session of the user at once (close 4403). */
  disconnectUser(userId: string): void {
    this.hub.disconnectUser(userId);
  }

  /** Recomputes assigned topics and re-checks subscriptions; the client gets a `topics` frame. */
  refreshTopics(userId: string): void {
    this.hub.refreshTopics(userId);
  }

  stats(): { connections: number; topics: number } {
    return this.hub.stats();
  }

  onApplicationBootstrap(): void {
    const server = this.adapterHost.httpAdapter?.getHttpServer() as Server | undefined;
    if (!server) {
      this.hub.options.logger.warn('realtime.no_http_server', {});
      return;
    }
    this.detach = attachRealtime(server, this.hub, this.hub.options);
  }

  // Before shutdown, not on it: clients must get 1012 while the process can still send.
  async beforeApplicationShutdown(): Promise<void> {
    await this.hub.shutdown();
    this.detach?.();
  }
}
