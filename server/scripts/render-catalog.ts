// Renders the task catalog as a Markdown table for the owner's review: npx ts-node scripts/render-catalog.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { audiences, catalog, themes } from '../src/content/task-catalog';

const label = {
  office: 'офіс',
  students: 'студенти',
  friends: 'друзі',
  family: 'сім’я',
  winter: 'зима/НР',
  weekend: 'вихідні',
  outside: 'назовні',
  creative: 'креатив',
  easy: 'легко',
  medium: 'середньо',
  hard: 'складно',
  home: 'вдома',
  any: 'будь-де',
} as const;

const t = (key: string): string => label[key as keyof typeof label] ?? key;

const lines: string[] = [
  '# Каталог завдань дня — v1',
  '',
  `**Завдань:** ${catalog.length} · UA + EN · джерело: \`server/src/content/task-catalog.ts\` (ця таблиця згенерована з нього).`,
  '',
  'Правила: лише власне оточення гравця; без незнайомих людей, документів, облич дітей крупним планом і небезпечних місць; сімейні завдання — без «складно + назовні». Тести каталогу: `server/src/content/task-catalog.spec.ts`.',
  '',
  '## Покриття',
  '',
  '| Тема | Завдань | | Аудиторія | Завдань |',
  '|---|---|---|---|---|',
];
const rows = Math.max(themes.length, audiences.length);
for (let i = 0; i < rows; i++) {
  const theme = themes[i];
  const audience = audiences[i];
  lines.push(
    `| ${theme ? t(theme) : ''} | ${theme ? catalog.filter((x) => x.themes.includes(theme)).length : ''} | | ${audience ? t(audience) : ''} | ${audience ? catalog.filter((x) => x.audiences.includes(audience)).length : ''} |`,
  );
}
lines.push('', '## Завдання', '', '| # | Назва (UA) | Опис (UA) | Title (EN) | Теми | Для кого | Складність | Де |', '|---|---|---|---|---|---|---|---|');
catalog.forEach((task, index) => {
  const cell = (value: string) => value.replace(/\|/g, '\\|');
  lines.push(
    `| ${index + 1} | ${cell(task.title.uk)} | ${cell(task.description.uk)} | ${cell(task.title.en)} | ${task.themes.map(t).join(', ')} | ${task.audiences.length === audiences.length ? 'усі' : task.audiences.map(t).join(', ')} | ${t(task.difficulty)} | ${t(task.place)} |`,
  );
});
lines.push('');

writeFileSync(join(__dirname, '../../docs/content/task-catalog-v1.md'), lines.join('\n'));
console.log(`rendered ${catalog.length} tasks`);
