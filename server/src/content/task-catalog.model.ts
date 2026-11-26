/**
 * Task catalog model. Categories are the tags from the design (SPEC §6); the
 * owner reviews the catalog before it seeds `tasks/{taskId}`.
 */

export const categories = ['home', 'street', 'office', 'cheap', 'kids', 'winter', 'summer', 'team', 'pair'] as const;
/** Who the task suits best; kept from v1 for the group-type filter. */
export const audiences = ['office', 'students', 'friends', 'family'] as const;
export const difficulties = ['easy', 'medium', 'hard'] as const;
/** `home` — doable without going out; `outside` — needs a walk; `any` — either. */
export const places = ['home', 'outside', 'any'] as const;

export type Category = (typeof categories)[number];
export type Audience = (typeof audiences)[number];
export type Difficulty = (typeof difficulties)[number];
export type Place = (typeof places)[number];

export interface TaskCatalogEntry {
  id: string;
  title: { uk: string; en: string };
  description: { uk: string; en: string };
  categories: Category[];
  audiences: Audience[];
  difficulty: Difficulty;
  place: Place;
}

export const all: Audience[] = ['office', 'students', 'friends', 'family'];

export function task(
  id: string,
  uk: [string, string],
  en: [string, string],
  categoryList: Category[],
  audienceList: Audience[],
  difficulty: Difficulty,
  place: Place,
): TaskCatalogEntry {
  return {
    id,
    title: { uk: uk[0], en: en[0] },
    description: { uk: uk[1], en: en[1] },
    categories: categoryList,
    audiences: audienceList,
    difficulty,
    place,
  };
}

// Northern-hemisphere months, 1–12: summer tasks wait for the warm season, winter ones for the cold.
const summerMonths = new Set([5, 6, 7, 8, 9]);
const winterMonths = new Set([11, 12, 1, 2, 3]);

/** Whether the daily picker may offer [entry] in [month] (1 = January). */
export function isOfferedInMonth(entry: TaskCatalogEntry, month: number): boolean {
  if (entry.categories.includes('summer')) return summerMonths.has(month);
  if (entry.categories.includes('winter')) return winterMonths.has(month);
  return true;
}
