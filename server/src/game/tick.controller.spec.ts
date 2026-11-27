import { Logger } from '@nestjs/common';
import { Group } from '../data/models';
import { GroupRepository } from '../data/repositories';
import { GameEngine } from './game-engine';
import { TickController } from './tick.controller';

const group = (id: string) => ({ id }) as Group;

describe('TickController', () => {
  const now = new Date('2026-12-01T07:00:00Z');
  const advanced: string[] = [];

  function controllerFor(ids: string[], failing: string[] = []): TickController {
    const groups = { listWithGame: async () => ids.map(group) } as unknown as GroupRepository;
    const engine = {
      async advance(groupId: string) {
        advanced.push(groupId);
        if (failing.includes(groupId)) {
          throw new Error(`broken ${groupId}`);
        }
      },
    } as unknown as GameEngine;
    return new TickController(engine, groups, () => now);
  }

  beforeEach(() => {
    advanced.length = 0;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('should advance every group with a game', async () => {
    expect(await controllerFor(['a', 'b', 'c']).tick()).toEqual({ advanced: 3, failed: 0 });
    expect(advanced).toEqual(['a', 'b', 'c']);
  });

  it('should keep going when one group breaks, and report it', async () => {
    const result = await controllerFor(['a', 'b', 'c'], ['b']).tick();
    expect(advanced).toEqual(['a', 'b', 'c']);
    expect(result).toEqual({ advanced: 2, failed: 1 });
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('should still answer when every group breaks', async () => {
    expect(await controllerFor(['a', 'b'], ['a', 'b']).tick()).toEqual({ advanced: 0, failed: 2 });
  });
});
