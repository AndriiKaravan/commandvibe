import {
  TaskCatalogEntry,
  audiences,
  catalog,
  categories,
  difficulties,
  isOfferedInMonth,
  places,
} from './task-catalog';

const texts = (task: TaskCatalogEntry) => [task.title.uk, task.title.en, task.description.uk, task.description.en];
const tagged = (category: string) => catalog.filter((task) => (task.categories as string[]).includes(category));
const matching = (list: TaskCatalogEntry[], patterns: RegExp[]) =>
  list.filter((task) => patterns.some((pattern) => texts(task).some((text) => pattern.test(text)))).map((task) => task.id);

describe('task catalog', () => {
  it('should define the nine categories from the design', () => {
    expect([...categories]).toEqual(['home', 'street', 'office', 'cheap', 'kids', 'winter', 'summer', 'team', 'pair']);
  });

  it('should hold at least 30 tasks in every category', () => {
    const short = categories.filter((category) => tagged(category).length < 30);
    expect(short.map((category) => `${category}: ${tagged(category).length}`)).toEqual([]);
  });

  it('should keep every task from v1', () => {
    for (const id of ['desk-view', 'snowman', 'word-of-the-day', 'little-chefs', 'new-place']) {
      expect(catalog.map((task) => task.id)).toContain(id);
    }
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
      for (const text of texts(task)) {
        expect(text.trim().length).toBeGreaterThan(2);
      }
      expect(task.title.uk.length).toBeLessThanOrEqual(60);
      expect(task.title.en.length).toBeLessThanOrEqual(60);
      expect(task.description.uk.length).toBeLessThanOrEqual(220);
      expect(task.description.en.length).toBeLessThanOrEqual(220);
    }
  });

  it('should give every task 1 to 4 distinct known categories and known fields', () => {
    for (const task of catalog) {
      expect(task.categories.length).toBeGreaterThanOrEqual(1);
      expect(task.categories.length).toBeLessThanOrEqual(4);
      expect(new Set(task.categories).size).toBe(task.categories.length);
      task.categories.forEach((category) => expect(categories).toContain(category));
      expect(task.audiences.length).toBeGreaterThan(0);
      task.audiences.forEach((audience) => expect(audiences).toContain(audience));
      expect(difficulties).toContain(task.difficulty);
      expect(places).toContain(task.place);
    }
  });

  it('should match the place to the home and street categories', () => {
    expect(tagged('home').filter((task) => task.place === 'outside').map((task) => task.id)).toEqual([]);
    expect(tagged('street').filter((task) => task.place === 'home').map((task) => task.id)).toEqual([]);
  });

  it('should never mark a task as both winter and summer', () => {
    expect(tagged('winter').filter((task) => task.categories.includes('summer')).map((task) => task.id)).toEqual([]);
  });

  it('should not offer summer tasks in December and offer them in July', () => {
    const summer = tagged('summer');
    expect(summer.filter((task) => isOfferedInMonth(task, 12)).map((task) => task.id)).toEqual([]);
    expect(summer.every((task) => isOfferedInMonth(task, 7))).toBe(true);
    expect(tagged('winter').filter((task) => isOfferedInMonth(task, 7)).map((task) => task.id)).toEqual([]);
    expect(isOfferedInMonth(catalog.find((task) => task.id === 'desk-view')!, 12)).toBe(true);
  });

  it('should keep kids tasks safe: for families, no hard outdoor tasks, no child left alone', () => {
    const kids = tagged('kids');
    expect(kids.filter((task) => !task.audiences.includes('family')).map((task) => task.id)).toEqual([]);
    expect(kids.filter((task) => task.difficulty === 'hard' && task.place === 'outside').map((task) => task.id)).toEqual([]);
    expect(
      matching(kids, [/дитин\S* сам/i, /без дорослих/i, /\balone\b/i, /on (his|her|their) own/i, /by (him|her|them)sel(f|ves)/i]),
    ).toEqual([]);
  });

  it('should keep family tasks kid-safe: no outside-only hard tasks', () => {
    const family = catalog.filter((task) => task.audiences.includes('family'));
    expect(family.filter((task) => task.difficulty === 'hard' && task.place === 'outside').map((task) => task.id)).toEqual([]);
  });

  it('should not make buying something a condition of a cheap task', () => {
    expect(
      matching(tagged('cheap'), [/купи/i, /купу/i, /купл/i, /придба/i, /замов/i, /\bbuy/i, /\bbought\b/i, /purchase/i, /\bgo shopping\b/i]),
    ).toEqual([]);
  });

  it('should not ask for strangers, documents, close-up faces of children or risky stunts', () => {
    // Every task is about the player's own surroundings; these words mark a request we never make.
    const banned = [
      /незнайом/i, /перехож/i, /stranger/i, /passer-?by/i,
      /паспорт/i, /документ/i, /passport/i, /document/i, /\bID\b/, /банківськ/i, /bank card/i,
      /обличчя дитини/i, /child'?s face/i,
      /на даху/i, /rooftop/i, /висот/i, /on the ice/i, /на льоду/i, /за кермом/i, /while driving/i,
      /алкогол/i, /alcohol/i, /\bbeer\b/i, /пиво/i, /\bвино\b/i, /\bwine\b/i,
      /пірна/i, /\bdiv(e|ing)\b/i, /багатт/i, /bonfire/i, /запали/i, /\blight (a|the) candle/i,
    ];
    expect(matching(catalog, banned)).toEqual([]);
  });
});
