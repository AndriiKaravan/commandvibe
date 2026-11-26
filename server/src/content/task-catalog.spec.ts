import {
  TaskCatalogEntry,
  audiences,
  catalog,
  categories,
  difficulties,
  isOfferedInMonth,
  places,
} from './task-catalog';
import { readFileSync } from 'node:fs';
import { catalogDocPath, renderCatalog } from './render-catalog';

const v1Ids = [
  'desk-view', 'mug-story', 'lunch-plate', 'team-hands', 'green-colleague', 'sticky-note-art', 'commute', 'meeting-doodle',
  'team-shadows', 'snack-stash', 'museum-piece', 'tidy-desk', 'coffee-art', 'window-weather', 'study-spot', 'best-notes',
  'campus-corner', 'book-tower', 'study-fuel', 'pen-army', 'now-playing', 'jump-shot', 'reflection', 'then-and-now',
  'human-letter', 'color-hunt', 'tiny-world', 'sky-today', 'house-boss', 'breakfast-together', 'drawing-together',
  'blanket-fort', 'shadow-puppets', 'build-of-the-day', 'little-chefs', 'big-and-small-hands', 'favourite-toy', 'game-night',
  'funny-socks', 'family-recipe', 'snow-close-up', 'snowman', 'ornament-story', 'holiday-lights', 'cozy-corner', 'warm-drink',
  'frosty-window', 'gift-wrap', 'new-year-wish', 'tangerine-art', 'winter-trail', 'holiday-sweater', 'holiday-cookies',
  'countdown', 'winter-treat', 'slow-breakfast', 'new-place', 'weekend-hobby', 'bookshelf', 'first-view', 'rest-spot',
  'oldest-tree', 'street-art', 'bird-spotting', 'puddle-world', 'interesting-door', 'step-goal', 'faces-in-things', 'rainbow',
  'food-face', 'forced-perspective', 'one-colour-look', 'black-and-white', 'living-emoji', 'find-me', 'word-of-the-day',
];

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
    expect(v1Ids).toHaveLength(76);
    const ids = new Set(catalog.map((task) => task.id));
    expect(v1Ids.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('should keep the owner review table in sync with the data', () => {
    expect(readFileSync(catalogDocPath, 'utf8')).toBe(renderCatalog());
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

  it('should keep kids tasks safe: for families, never hard, no child left alone', () => {
    const kids = tagged('kids');
    expect(kids.filter((task) => !task.audiences.includes('family')).map((task) => task.id)).toEqual([]);
    expect(kids.filter((task) => task.difficulty === 'hard').map((task) => task.id)).toEqual([]);
    expect(
      matching(kids, [
        /дитин\S* сам/i, /діти самі/i, /малюк\S* сам/i, /без дорослих/i,
        /\balone\b/i, /on (his|her|their|its) own/i, /by (him|her|them)sel(f|ves)/i, /unsupervised/i,
      ]),
    ).toEqual([]);
  });

  it('should keep kids tasks away from open water and roads', () => {
    expect(
      matching(tagged('kids'), [/калюж/i, /puddle/i, /річк/i, /river/i, /озер/i, /\blakes?\b/i, /\bpond\b/i, /дорог/i, /\broads?\b/i, /трас/i]),
    ).toEqual([]);
  });

  it('should offer adult-and-child tasks to families only', () => {
    const adultAndChild = matching(catalog, [/дорослий і дитина/i, /дорослого й дитини/i, /an adult and a child/i, /adult.s and a child.s/i]);
    expect(adultAndChild.length).toBeGreaterThan(0);
    const offenders = catalog.filter((task) => adultAndChild.includes(task.id) && task.audiences.join() !== 'family');
    expect(offenders.map((task) => task.id)).toEqual([]);
  });

  it('should keep family tasks kid-safe: no outside-only hard tasks', () => {
    const family = catalog.filter((task) => task.audiences.includes('family'));
    expect(family.filter((task) => task.difficulty === 'hard' && task.place === 'outside').map((task) => task.id)).toEqual([]);
  });

  it('should not make buying something a condition of a cheap task', () => {
    expect(
      // Cyrillic letters are not word characters for \b, hence the explicit word edges.
      matching(tagged('cheap'), [
        /(^|[^а-яіїєґ])(купи|купіть|купити|купуй|купуйте|купляй)([^а-яіїєґ]|$)/i, /придба/i, /замовте|замов(и|ити)([^а-яіїєґ]|$)/i,
        /\bbuy/i, /\bbought\b/i, /purchase/i, /\bgo shopping\b/i, /\border (a|some|one)\b/i,
      ]),
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
