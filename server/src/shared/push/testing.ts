// generated from ks_server/push — do not edit; run: npm run sync:push
import { PushBatchResponse, PushContent, PushLogger, PushMessaging, PushSendResponse } from './push.types';

/**
 * FCM stand-in: records what was sent and answers per token or topic.
 * `failToken`/`failTopic` set an error code; `throwOnCall` makes the n-th
 * call (1-based, across methods) reject as the network would.
 */
export class FakePushMessaging implements PushMessaging {
  readonly multicasts: (PushContent & { tokens: string[] })[] = [];
  readonly topicMessages: (PushContent & { topic: string })[] = [];
  private readonly tokenErrors = new Map<string, string>();
  private readonly topicErrors = new Map<string, string>();
  private readonly throwing = new Map<number, Error>();
  private calls = 0;

  failToken(token: string, code: string): this {
    this.tokenErrors.set(token, code);
    return this;
  }

  failTopic(topic: string, code: string): this {
    this.topicErrors.set(topic, code);
    return this;
  }

  throwOnCall(call: number, error: Error = Object.assign(new Error('unavailable'), { code: 'app/network-error' })): this {
    this.throwing.set(call, error);
    return this;
  }

  /** Every token any multicast was sent to, in order. */
  get sentTokens(): string[] {
    return this.multicasts.flatMap((message) => message.tokens);
  }

  async sendEachForMulticast(message: PushContent & { tokens: string[] }): Promise<PushBatchResponse> {
    this.enter();
    this.multicasts.push(message);
    return batch(message.tokens.map((token) => response(this.tokenErrors.get(token))));
  }

  async sendEach(messages: (PushContent & { topic: string })[]): Promise<PushBatchResponse> {
    this.enter();
    this.topicMessages.push(...messages);
    return batch(messages.map((message) => response(this.topicErrors.get(message.topic))));
  }

  async send(message: PushContent & { topic: string }): Promise<string> {
    this.enter();
    this.topicMessages.push(message);
    const code = this.topicErrors.get(message.topic);
    if (code) throw Object.assign(new Error(code), { code });
    return `projects/fake/messages/${this.calls}`;
  }

  private enter(): void {
    const error = this.throwing.get(++this.calls);
    if (error) throw error;
  }
}

/** Logger that keeps every line for assertions. */
export class RecordingPushLogger implements PushLogger {
  readonly lines: { level: 'info' | 'warn'; message: string; fields?: object }[] = [];

  info(message: string, fields?: object): void {
    this.lines.push({ level: 'info', message, fields });
  }

  warn(message: string, fields?: object): void {
    this.lines.push({ level: 'warn', message, fields });
  }

  get text(): string {
    return JSON.stringify(this.lines);
  }
}

function response(code: string | undefined): PushSendResponse {
  return code ? { success: false, error: { code } } : { success: true };
}

function batch(responses: PushSendResponse[]): PushBatchResponse {
  const successCount = responses.filter((r) => r.success).length;
  return { successCount, failureCount: responses.length - successCount, responses };
}
