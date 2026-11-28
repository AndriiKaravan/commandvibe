// generated from ks_server/push — do not edit; run: npm run sync:push
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PushContent, PushLogger, PushOptions, PushPlatform, PushReport } from './push.types';
import { PUSH_OPTIONS } from './push.tokens';

// FCM takes at most 500 tokens in one multicast and 500 messages in one sendEach.
const FCM_BATCH_LIMIT = 500;
const GONE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
// `messaging/invalid-argument` is not here: FCM v1 also returns it for a payload
// that is invalid for one platform only, which would wipe healthy tokens.

function nestLogger(): PushLogger {
  const logger = new Logger('Push');
  const line = (message: string, fields?: object) => (fields ? `${message} ${JSON.stringify(fields)}` : message);
  return {
    info: (message, fields) => logger.log(line(message, fields)),
    warn: (message, fields) => logger.warn(line(message, fields)),
  };
}

const codeOf = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : 'unknown';
};

/**
 * Personal pushes to the device tokens each account registered, broadcasts to
 * topics. Sends never throw: failures are counted in the report and logged
 * as counts and FCM error codes only.
 */
@Injectable()
export class PushService {
  private readonly logger: PushLogger;

  constructor(@Inject(PUSH_OPTIONS) private readonly options: PushOptions) {
    this.logger = options.logger ?? nestLogger();
  }

  registerToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
    return this.options.store.register(userId, token, platform);
  }

  removeToken(userId: string, token: string): Promise<void> {
    return this.options.store.remove(userId, token);
  }

  /** Call when an account is deleted. Throws if the store fails, so deletion can retry. */
  removeAllOf(userId: string): Promise<void> {
    return this.options.store.removeAllOf(userId);
  }

  async sendToUsers(userIds: readonly string[], content: PushContent): Promise<PushReport> {
    const report: PushReport = { tokens: 0, sent: 0, failed: 0, removed: 0, topicSent: 0, topicFailed: 0, errors: {} };
    const users = [...new Set(userIds)];
    if (users.length === 0) return report;
    await Promise.all([this.sendToTokens(users, content, report), this.sendToLegacyTopics(users, content, report)]);
    this.log('info', 'push sent', report);
    return report;
  }

  /** Broadcast to an FCM topic. False when FCM rejected it. */
  async sendToTopic(topic: string, content: PushContent): Promise<boolean> {
    try {
      await this.options.messaging.send({ ...content, topic });
      return true;
    } catch (error) {
      this.log('warn', 'push topic send failed', { code: codeOf(error) });
      return false;
    }
  }

  /** A failing logger must not turn a delivered push into a rejected call. */
  private log(level: 'info' | 'warn', message: string, fields: object): void {
    try {
      this.logger[level](message, fields);
    } catch {
      // Nothing left to report to.
    }
  }

  private async sendToTokens(users: string[], content: PushContent, report: PushReport): Promise<void> {
    let tokens: string[];
    try {
      tokens = [...new Set(await this.options.store.tokensOf(users))];
    } catch (error) {
      count(report, 'store/lookup-failed');
      this.log('warn', 'push token lookup failed', { code: codeOf(error) });
      return;
    }
    report.tokens = tokens.length;
    const gone: string[] = [];
    for (let i = 0; i < tokens.length; i += FCM_BATCH_LIMIT) {
      gone.push(...(await this.sendBatch(tokens.slice(i, i + FCM_BATCH_LIMIT), content, report)));
    }
    if (gone.length === 0) return;
    try {
      await this.options.store.forget(gone);
      report.removed = gone.length;
    } catch (error) {
      this.log('warn', 'push token cleanup failed', { code: codeOf(error), tokens: gone.length });
    }
  }

  /** Sends one multicast; returns the tokens FCM reported as gone. */
  private async sendBatch(batch: string[], content: PushContent, report: PushReport): Promise<string[]> {
    try {
      const response = await this.options.messaging.sendEachForMulticast({ ...content, tokens: batch });
      const gone: string[] = [];
      response.responses.forEach((r, j) => {
        if (r.success) {
          report.sent++;
          return;
        }
        const code = r.error?.code ?? 'unknown';
        report.failed++;
        count(report, code);
        if (GONE_TOKEN_CODES.has(code)) gone.push(batch[j]);
      });
      return gone;
    } catch (error) {
      report.failed += batch.length;
      count(report, codeOf(error), batch.length);
      return [];
    }
  }

  private async sendToLegacyTopics(users: string[], content: PushContent, report: PushReport): Promise<void> {
    const topicOf = this.options.legacyUserTopic;
    if (!topicOf) return;
    for (let i = 0; i < users.length; i += FCM_BATCH_LIMIT) {
      const chunk = users.slice(i, i + FCM_BATCH_LIMIT);
      try {
        const messages = chunk.map((uid) => ({ ...content, topic: topicOf(uid) }));
        const response = await this.options.messaging.sendEach(messages);
        report.topicSent += response.successCount;
        report.topicFailed += response.failureCount;
        for (const r of response.responses) if (!r.success) count(report, r.error?.code ?? 'unknown');
      } catch (error) {
        report.topicFailed += chunk.length;
        count(report, codeOf(error), chunk.length);
      }
    }
  }
}

function count(report: PushReport, code: string, by = 1): void {
  report.errors[code] = (report.errors[code] ?? 0) + by;
}
