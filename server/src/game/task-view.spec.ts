import { catalog, retiredCatalog } from '../content/task-catalog';
import { taskView } from './views';

describe('taskView', () => {
  it('should show a task the owner retired as it was, for games that already hold it', () => {
    expect(retiredCatalog.map((task) => task.id).sort()).toEqual(
      ['letter-for-two', 'mirror-pose', 'mittens', 'scarf-chain', 'team-game', 'team-hands', 'team-mugs'].sort(),
    );
    const view = taskView({ kind: 'catalog', taskId: 'mittens' });
    expect(view.title.uk).toBe('Рукавиці');
    expect(view.description.uk).not.toBe('');
  });

  it('should never offer a retired task to new calendars', () => {
    const offered = new Set(catalog.map((task) => task.id));
    expect(retiredCatalog.filter((task) => offered.has(task.id))).toEqual([]);
  });

  it('should fall back to the id for a task nobody knows', () => {
    expect(taskView({ kind: 'catalog', taskId: 'never-existed' }).title.uk).toBe('never-existed');
  });
});
