// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { TopicIndex } from './topic-index';

describe('TopicIndex', () => {
  it('should return the sessions added to a topic', () => {
    const index = new TopicIndex<string>();
    index.add('group:a', 's1');
    index.add('group:a', 's2');
    expect([...index.get('group:a')]).toEqual(['s1', 's2']);
    expect([...index.get('group:b')]).toEqual([]);
  });

  it('should drop a topic once its last session is removed', () => {
    const index = new TopicIndex<string>();
    index.add('group:a', 's1');
    index.add('group:b', 's1');
    index.remove('group:a', 's1');
    expect(index.topicCount).toBe(1);
  });

  it('should remove a session from every topic', () => {
    const index = new TopicIndex<string>();
    index.add('group:a', 's1');
    index.add('group:b', 's1');
    index.add('group:b', 's2');
    index.removeAll('s1', ['group:a', 'group:b']);
    expect(index.topicCount).toBe(1);
    expect([...index.get('group:b')]).toEqual(['s2']);
  });
});
