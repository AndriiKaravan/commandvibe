// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
const EMPTY: ReadonlySet<never> = new Set();

/** Topic → sessions index, so publishing does not scan every session. */
export class TopicIndex<S> {
  private readonly byTopic = new Map<string, Set<S>>();

  add(topic: string, session: S): void {
    let sessions = this.byTopic.get(topic);
    if (!sessions) {
      sessions = new Set();
      this.byTopic.set(topic, sessions);
    }
    sessions.add(session);
  }

  remove(topic: string, session: S): void {
    const sessions = this.byTopic.get(topic);
    if (!sessions) return;
    sessions.delete(session);
    if (sessions.size === 0) this.byTopic.delete(topic);
  }

  removeAll(session: S, topics: Iterable<string>): void {
    for (const topic of topics) this.remove(topic, session);
  }

  get(topic: string): ReadonlySet<S> {
    return this.byTopic.get(topic) ?? EMPTY;
  }

  get topicCount(): number {
    return this.byTopic.size;
  }
}
