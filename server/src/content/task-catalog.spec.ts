import { TaskCatalogEntry, audiences, catalog, difficulties, places, themes } from './task-catalog';

describe('task catalog', () => {
  it('should hold at least 60 tasks', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(60);
  });

  it('should have unique ids in kebab case', () => {
    const ids = catalog.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('should be complete in Ukrainian and English', () => {
    for (const task of catalog) {
      for (const text of [task.title.uk, task.title.en, task.description.uk, task.description.en]) {
        expect(text.trim().length).toBeGreaterThan(2);
      }
      expect(task.title.uk.length).toBeLessThanOrEqual(60);
      expect(task.title.en.length).toBeLessThanOrEqual(60);
      expect(task.description.uk.length).toBeLessThanOrEqual(220);
      expect(task.description.en.length).toBeLessThanOrEqual(220);
    }
  });

  it('should use only known themes, audiences, difficulty and place', () => {
    for (const task of catalog) {
      expect(task.themes.length).toBeGreaterThan(0);
      task.themes.forEach((theme) => expect(themes).toContain(theme));
      expect(task.audiences.length).toBeGreaterThan(0);
      task.audiences.forEach((audience) => expect(audiences).toContain(audience));
      expect(difficulties).toContain(task.difficulty);
      expect(places).toContain(task.place);
    }
  });

  it('should cover every theme with at least 6 tasks and every audience with at least 20', () => {
    for (const theme of themes) {
      expect(catalog.filter((task) => task.themes.includes(theme)).length).toBeGreaterThanOrEqual(6);
    }
    for (const audience of audiences) {
      expect(catalog.filter((task) => task.audiences.includes(audience)).length).toBeGreaterThanOrEqual(20);
    }
  });

  it('should keep family tasks kid-safe: no outside-only hard tasks', () => {
    const family = catalog.filter((task) => task.audiences.includes('family'));
    expect(family.filter((task) => task.difficulty === 'hard' && task.place === 'outside')).toEqual([]);
  });

  it('should not ask for strangers, documents, close-up faces of children or risky stunts', () => {
    // Every task is about the player's own surroundings; these words mark a request we never make.
    const banned = [
      /незнайом/i, /перехож/i, /stranger/i, /passer-?by/i,
      /паспорт/i, /документ/i, /passport/i, /document/i, /\bID\b/, /банківськ/i, /bank card/i,
      /обличчя дитини/i, /child'?s face/i,
      /на даху/i, /rooftop/i, /висот/i, /on the ice/i, /на льоду/i, /за кермом/i, /while driving/i,
      /алкогол/i, /alcohol/i, /\bbeer\b/i, /пиво/i, /вино/i, /\bwine\b/i,
    ];
    const offenders = (task: TaskCatalogEntry) =>
      banned.filter((pattern) =>
        [task.title.uk, task.title.en, task.description.uk, task.description.en].some((text) => pattern.test(text)),
      );
    expect(catalog.filter((task) => offenders(task).length > 0).map((task) => task.id)).toEqual([]);
  });
});
