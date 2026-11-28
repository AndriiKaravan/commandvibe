// Renders the task catalog as Markdown for the owner's review: npx ts-node src/content/render-catalog.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Category, TaskCatalogEntry, audiences, catalog, categories } from './task-catalog';

export const catalogDocPath = join(__dirname, '../../../docs/content/task-catalog-v2.md');

const label: Record<string, string> = {
  home: 'вдома',
  street: 'вулиця',
  office: 'офіс',
  cheap: 'дешево',
  kids: 'з дітьми',
  winter: 'зима',
  summer: 'літо',
  team: 'командне',
  pair: 'парне',
  students: 'студенти',
  friends: 'друзі',
  family: 'сім’я',
  easy: 'легко',
  medium: 'середньо',
  hard: 'складно',
  outside: 'назовні',
  any: 'будь-де',
};
// `home` is both a category and a place; the place column reads it as a place.
const placeLabel: Record<string, string> = {
  home: 'вдома',
  outside: 'назовні',
  any: 'будь-де',
};

const t = (key: string): string => label[key] ?? key;
const cell = (value: string) => value.replace(/\|/g, '\\|');
const tagged = (category: Category) => catalog.filter((task) => task.categories.includes(category));
const section = (category: Category) => catalog.filter((task) => task.categories[0] === category);
const forWhom = (task: TaskCatalogEntry) =>
  task.audiences.length === audiences.length ? 'усі' : task.audiences.map(t).join(', ');

/** The owner-facing Markdown table of the whole catalog. */
export function renderCatalog(): string {
  const lines: string[] = [
    '# Каталог завдань дня — v2',
    '',
    `**Завдань:** ${catalog.length} · UA + EN · джерело: \`server/src/content/task-catalog.data.ts\` (цей файл згенерований з нього, правки — там).`,
    '',
    'Кожне завдання має 1–4 категорії; воно стоїть у розділі **першої** категорії, решта — у стовпці «Ще теги». У кожній категорії — щонайменше 29 завдань.',
    '',
    'Правила (перевіряють тести `server/src/content/task-catalog.spec.ts`): лише власне оточення гравця; без незнайомих людей, документів, облич дітей крупним планом і небезпечних місць; «з дітьми» — без «складно + назовні» і без завдань, де дитина сама; «дешево» — без покупок як умови; «літо» автопідбір пропонує лише з травня по вересень, «зима» — з листопада по березень.',
    '',
    '## Покриття',
    '',
    '| Категорія | Завдань із тегом | У розділі |',
    '|---|---|---|',
    ...categories.map((category) => `| ${t(category)} | ${tagged(category).length} | ${section(category).length} |`),
  ];

  for (const category of categories) {
    const tasks = section(category);
    if (tasks.length === 0) continue;
    lines.push(
      '',
      `## ${t(category)} (${tagged(category).length} з тегом, ${tasks.length} у розділі)`,
      '',
      '| # | Назва (UA) | Опис (UA) | Title (EN) | Ще теги | Для кого | Складність | Де |',
      '|---|---|---|---|---|---|---|---|',
    );
    tasks.forEach((task, index) => {
      lines.push(
        `| ${index + 1} | ${cell(task.title.uk)} | ${cell(task.description.uk)} | ${cell(task.title.en)} | ${task.categories.slice(1).map(t).join(', ') || '—'} | ${forWhom(task)} | ${t(task.difficulty)} | ${placeLabel[task.place]} |`,
      );
    });
  }
  lines.push('');
  return lines.join('\n');
}

if (require.main === module) {
  writeFileSync(catalogDocPath, renderCatalog());
  console.log(`rendered ${catalog.length} tasks`);
}
