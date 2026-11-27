# CommandVibe P2 — календар, «авто щодня», рулетка: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Організатор налаштовує гру (дата старту, 7–31 день, час відкриття, режим «авто щодня» або «рулетка», категорії) і складає календар (авто / вручну / «Інше» / своє / переставити). Завдання дня відкривається за розкладом у часовому поясі групи. У режимі «рулетка» гра щодня обирає учасника, той крутить рулетку, і всі клієнти бачать ту саму анімацію. Хто не крутнув за 3 год — крутить гра.

**Architecture:** Новий модуль сервера `game/`:
- чисті функції: час у поясі групи, підбір завдань, вибір того, хто крутить;
- репозиторій клітинок `cells` (пам'ять + Firestore, спільний контрактний набір);
- `GameEngine.advance(groupId, now)` — ідемпотентні переходи клітинок. Його викликають і `/internal/tick` (Cloud Scheduler, OIDC), і читання `today`/`calendar`, тож гра йде навіть без Scheduler.

Події йдуть у realtime-тему `group:<id>`. Клієнт: фіча `calendar` (конструктор організатора) і фіча `today` (картка дня + колесо рулетки). Анімація — чиста функція кута від часу сервера.

**Tech Stack:** як у P1. Без нових залежностей у сервері, крім `google-auth-library` (перевірка OIDC-токена Scheduler; уже транзитивно є через firebase-admin, додати явно).

**Spec:** `docs/specs/2026-11-19-photo-challenge-design.md` — розділи 2а (п. 2, 3), 6а «Сьогодні» і «Календар», 9 «Календар», «Режими вибору завдання», «База завдань», 12. Дорожня карта: `docs/superpowers/plans/2026-11-26-wave1-roadmap.md` (P2). Каталог: `server/src/content/task-catalog*.ts` (v2; у Firestore `tasks/` не пишемо до «каталог погоджено» — сервер читає каталог із коду).

## Global Constraints

- **Тривалість гри** — 7–31 день; **початок** — будь-яка дата від «сьогодні» в поясі групи.
- **Час відкриття** — `openTime` `HH:mm` у поясі групи, за замовчуванням `09:00`.
- **Розкриття фото** о 9:00 — P3, тут не робиться.
- **Режими хвилі 1:** `auto` (авто щодня) і `roulette` (2а п. 3). Інші режими (розділ 9, № 3–8) — не в P2.
- **Рулетка:**
  - Учасника, який крутить, гра обирає при відкритті дня серед активних учасників, що грають. Організатор, який не грає, не крутить.
  - Пріоритет — у тих, хто крутив найменше разів, тож кожен гарантовано отримує чергу (розділ 9).
  - Вибраний учасник має **3 год**. Далі крутить гра.
  - Колесо — **дверцята, що лишились** (номери днів), а не назви завдань: учасники майбутніх завдань не бачать (розділ 9 «База завдань»).
- **Синхронна анімація.** Сервер записує `startAt = now + 1500 мс`, `durationMs = 5000`, переможця й порядок дверцят і розсилає подію разом із `serverTime`. Клієнт рахує кут від часу сервера. Хто зайшов пізніше — бачить повтор 1500 мс і результат (6а «Сьогодні»).
- **Конструктор:**
  - Авто — за категоріями без повторів, з урахуванням сезону дати дня (`isOfferedInMonth`).
  - «Інше» — наступне завдання з тих самих категорій, якого в цій грі ще немає.
  - Вручну — будь-яке завдання каталогу.
  - Своє завдання — UA обов'язково, EN за бажанням; назва ≤ 60, опис ≤ 220.
  - Переставити — обмін двох днів.
  - Міняти можна лише дні, які ще не відкрились. Налаштування гри — лише до відкриття першого дня.
- **Хто що бачить.** Учасник бачить завдання лише відкритих днів. Майбутні дні — «зачинені дверцята» без назви, і в календарі, і в подіях. Організатор бачить усе.
- **Тексти UI** — через `l10n` (UA основна, EN рядки поруч).
- **Пристрої.** Тести клієнта — юніт- і віджет-тести та headless Chrome (`tool/e2e_web.mjs`). **Симулятори й емулятори без власника не запускати.** Збірки `apk --debug` і `ios --simulator` — дозволені, вони нічого не запускають.
- **Інфраструктура.** Cloud Scheduler і сервісний акаунт для `/internal/tick` — кроки власника в `docs/deploy.md`. Без них `/internal/tick` відповідає `404`, а гра просувається при читаннях.

## Review Focus

- **Перехід на літній/зимовий час** (Europe/Kyiv, 29.03 і 25.10): день гри відкривається о 09:00 місцевого часу, а не о 08:00 чи 10:00 — тест у Task 1.
- **Гру створили сьогодні після `openTime`** (старт сьогодні, зараз 10:00): день 0 відкривається одразу при першому `advance`, а не завтра — тест у Task 5.
- **Два `advance` паралельно** (Scheduler повторив запит, або учасник відкрив застосунок у ту ж мить), а також **крутіння учасника рівно на дедлайні проти автокрутіння гри**: клітинка відкривається один раз, подія одна, переможець один — тест у Task 5.
- **Витік майбутніх завдань учаснику** через `GET calendar`, `GET today` або подію `roulette.spin` — тест у Task 4 і Task 5.
- **Вузькі категорії на 31 день** (наприклад, лише `pair` у грудні): підбір не падає і не повторюється — бере сезонні завдання поза категоріями. Тест у Task 3.

---

### Task 1: Час гри в поясі групи

**Files:**
- Create: `server/src/game/game-time.ts`, `server/src/game/game-time.spec.ts`

**Interfaces:**
- Produces:
  - `zonedToUtc(date: string /* YYYY-MM-DD */, time: string /* HH:mm */, timeZone: string): Date`
  - `localDate(instant: Date, timeZone: string): string`
  - `addDays(date: string, days: number): string`
  - `dayOpensAt(game: { startDate: string; openTime: string }, dayIndex: number, timeZone: string): Date`
  - `isValidDate(s)`, `isValidTime(s)`

- [ ] Тести (RED):
  - `zonedToUtc('2026-12-01','09:00','Europe/Kyiv')` = `2026-12-01T07:00Z`;
  - на 2027-03-28 (до переходу) — `07:00Z`, на 2027-03-29 (після переходу) — `06:00Z`;
  - на 2027-10-31 — знову `07:00Z`;
  - `America/New_York` — `14:00Z` взимку;
  - `localDate` на межі доби: `2026-12-01T22:30Z` у Kyiv дає `2026-12-02`;
  - `addDays` через кінець місяця й року;
  - `isValidDate('2026-02-30')` = false, `isValidTime('24:00')` = false.
- [ ] Реалізація на `Intl.DateTimeFormat` (зсув поясу за двома ітераціями), без нових залежностей.
- [ ] `npx jest src/game/game-time` → PASS. Коміт.

### Task 2: Модель гри й клітинок, репозиторій `cells`

**Files:**
- Modify: `server/src/data/models.ts`, `server/src/data/repositories.ts`, `server/src/data/repositories.contract.ts`, `server/src/data/memory/memory-repositories.ts`, `server/src/data/firestore/firestore-repositories.ts`, `server/src/data/data.module.ts`

**Interfaces:**
- Produces:
  - `GameMode = 'auto' | 'roulette'`
  - `GameSettings { startDate; days; openTime; mode; categories: Category[] }` — поле `Group.game?`
  - `TaskRef = { kind: 'catalog'; taskId } | { kind: 'custom'; title: {uk; en?}; description: {uk; en?} }`
  - `CellState = 'closed' | 'picking' | 'open'`
  - `RouletteSpin { startAt: Date; durationMs; doors: number[]; winnerIndex; by: 'member' | 'game' }`
  - `Cell { groupId; dayIndex; task: TaskRef; opensAt: Date; state; openedAt?; pickerMemberId?; pickDeadlineAt?; spin? }`
  - `CellRepository`:
    - `list(groupId): Promise<Cell[]>` (за `dayIndex`);
    - `replaceAll(groupId, cells): Promise<void>` — видаляє старі, пише нові;
    - `get(groupId, dayIndex)`;
    - `transition(groupId, dayIndex, expected: CellState, patch: Partial<Cell>): Promise<boolean>` — транзакція: пише, лише якщо стан `expected`;
    - `swapTasks(groupId, a, b, onlyIf: (cellA, cellB) => boolean): Promise<boolean>` — транзакція.
  - Токен `CELLS`.
- Firestore: `groups/{id}/cells/{dayIndex у вигляді 2 цифр}`.

- [ ] Контрактні тести (RED, однакові для пам'яті й Firestore):
  - `replaceAll` + `list` повертає впорядковано;
  - `transition` з неправильним `expected` дає `false` і нічого не змінює;
  - **10 паралельних `transition('closed'→'open')` — рівно один `true`**;
  - `swapTasks` міняє лише задачі, `onlyIf=false` нічого не міняє;
  - `Group.game` зберігається і читається з датами.
- [ ] Реалізація (пам'ять, Firestore — `runTransaction`). Запустити `npx jest src/data` → PASS. Firestore-частину — у Docker: `tool/firestore_contract.sh` або контейнер, як у звіті 27.11. Коміт.

### Task 3: Підбір завдань і вибір того, хто крутить

**Files:**
- Create: `server/src/game/task-picker.ts`, `server/src/game/task-picker.spec.ts`, `server/src/game/roulette.ts`, `server/src/game/roulette.spec.ts`

**Interfaces:**
- Consumes: `catalog`, `isOfferedInMonth`, `Category` з `content/task-catalog`; `addDays` (Task 1).
- Produces:
  - `type Random = () => number`
  - `autoPick(input: { startDate; days; categories }, random: Random): TaskRef[]`
  - `nextOther(input: { date; categories; used: Set<string> }, random): TaskRef | undefined`
  - `pickPicker(candidates: string[], cells: Cell[], random): string | undefined` — серед тих, хто крутив найменше
  - `spinDoors(closedDays: number[], random): { doors: number[]; winnerIndex: number }`

- [ ] Тести (RED):
  - 31 день із `['winter']` — без повторів; кожне завдання з тегом `winter` (коли їх вистачає) і пропонується в місяці свого дня;
  - 31 день із `['pair']` у грудні — 31 унікальне, жодного `summer`; спершу йдуть `pair`, потім добираються будь-які сезонні;
  - 7 днів, старт 28.04 → у травневих днях можливе `summer`, у квітневих — ні;
  - `nextOther` не повертає `used`, для вичерпаних категорій бере будь-яке сезонне; коли вичерпано все — `undefined`;
  - `pickPicker`: у `[a,b,c]`, де `a` крутив 2 рази, а `b` 1 раз, вибір — лише `c`; порожній список дає `undefined`;
  - `spinDoors`: `doors` — перестановка `closedDays`, `winnerIndex` у межах.
- [ ] Реалізація (тасування Фішера–Єйтса з `random`). Тести → PASS. Коміт.

### Task 4: Конструктор календаря — API

**Files:**
- Create: `server/src/game/calendar.service.ts`, `server/src/game/calendar.service.spec.ts`, `server/src/game/game.controller.ts`, `server/src/game/game.module.ts`, `server/src/game/views.ts`, `server/test/calendar.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: Task 1–3; `GroupsService.owned/getFor`, `CLOCK`, `IdPipe`.
- Produces (REST, помилки `code`):
  - `GET /catalog?category=&q=` (організатор) → `{tasks: CatalogTaskView[]}`. Пошук — без регістру, у назві й описі обох мов.
  - `PUT /groups/:id/game` (власник) з `{startDate, days, openTime?, mode, categories}`:
    - `422`: `invalid_date`, `start_in_past`, `invalid_days`, `invalid_time`, `invalid_mode`, `invalid_categories`;
    - `409 game_started` — уже відкрито день 0.
    Генерує клітинки (`autoPick`) і повертає `CalendarView`.
  - `GET /groups/:id/calendar` (власник / активний учасник) → `{game, days: DayView[], serverTime}`. Стан клітинок — як у базі; `GameEngine.advance` перед відповіддю додає Task 5.
    - `DayView {dayIndex, date, opensAt, state, task?}`;
    - для учасника `task` є лише при `state='open'`.
  - `POST /groups/:id/calendar/days/:day/other` (власник) → `DayView`. `409 day_opened`, `409 no_more_tasks`.
  - `PUT /groups/:id/calendar/days/:day/task` (власник) з `{taskId}` або `{custom:{title:{uk,en?},description:{uk,en?}}}`. `422 unknown_task`, `422 invalid_custom`, `409 day_opened`, `409 task_in_game`.
  - `POST /groups/:id/calendar/days/:day/move` (власник) з `{to}` → `CalendarView`. `409 day_opened`, `422 invalid_day`.
  - `:day` — ціле число в межах `0..days-1`, інакше `400 invalid_day`.
- `CatalogTaskView`/`TaskView` = `{id?, title{uk,en?}, description{uk,en?}, categories?, custom: boolean}`.

- [ ] Тести сервісу й e2e (RED):
  - кожна помилка вище;
  - **учасник у `GET calendar` бачить `task` лише відкритих днів; закриті — без `task`**;
  - чужий організатор отримує `403`;
  - «Інше» не повторює завдань гри;
  - переставити день 2 ↔ 5 міняє лише їх;
  - відкритий день не міняється (`409`).
- [ ] Реалізація. Запустити `npx jest src/game && npx jest --config ./test/jest-e2e.json calendar` → PASS. Коміт.

### Task 5: Двигун гри — відкриття, рулетка, «Сьогодні»

**Files:**
- Create: `server/src/game/game-engine.ts`, `server/src/game/game-engine.spec.ts`, `server/src/game/game-events.ts`, `server/test/today.e2e-spec.ts`
- Modify: `server/src/game/game.controller.ts`, `server/src/game/calendar.service.ts` (`GET calendar` викликає `advance`), `server/src/game/game.module.ts`

**Interfaces:**
- Consumes: Task 1–4; `RealtimeService.publish`, `groupTopic`.
- Produces:
  - `GameEngine.advance(groupId: string, now: Date): Promise<void>`. Для кожної клітинки з `opensAt <= now` за порядком днів:
    - `auto`: `closed → open` (`openedAt = now`) і подія `day.opened {dayIndex}`;
    - `roulette`, `closed`: `→ picking` з `pickerMemberId` (`pickPicker`; немає кандидатів — одразу крутить гра) і `pickDeadlineAt = opensAt + 3 год`; подія `roulette.waiting {dayIndex, pickerMemberId, deadlineAt}`;
    - `roulette`, `picking` з дедлайном `<= now`: крутить гра.
    - `group.status` `draft → active` при першому відкритті; `active → finished`, коли `now >= opensAt(останній) + 24 год`.
  - `GameEngine.spin(groupId, memberId, now)`:
    - `403 not_your_turn`, `409 not_picking`, `409 deadline_passed`;
    - переможець — дверцята з `spinDoors` серед закритих днів, разом із сьогоднішнім. Завдання переможця міняється місцем із сьогоднішнім (`swapTasks`). Далі `picking → open` зі `spin` (`startAt = now + 1500`, `durationMs = 5000`).
    - Подія `roulette.spin {dayIndex, doors, winnerIndex, startAt, durationMs, serverTime, by}`, потім `day.opened`.
    - Гонку «учасник ↔ автокрутіння» вирішує `transition('picking')`: публікує лише переможець.
  - `GET /groups/:id/today` → `{game?, day?: DayView & {pickerMemberId?, pickDeadlineAt?, spin?}, dayIndex?, status: 'not_configured'|'before_start'|'active'|'finished', serverTime}`
  - `POST /groups/:id/roulette/spin` (учасник; організатор, що грає) → `204`.

- [ ] Тести (`CLOCK` і `Random` підмінені, RED):
  - `auto`: до 09:00 день закритий, о 09:00 відкритий, подія одна;
  - **два `advance` паралельно — одна подія `day.opened`**;
  - старт сьогодні о 10:00 — день 0 відкривається на першому `advance`;
  - пропущено 3 дні (немає tick) — усі 3 відкриваються по черзі;
  - `roulette`: призначено одного з учасників, що грають, без організатора, який не грає;
  - spin від не-вибраного учасника — `403`;
  - spin після дедлайну — `409`;
  - автокрутіння після 3 год — `by: 'game'`;
  - **spin і автокрутіння одночасно — один `roulette.spin`**;
  - **подія `roulette.spin` і `GET today` не містять назв завдань закритих днів**;
  - `finished` після останнього дня.
  - e2e: два ws-клієнти учасників отримують ідентичну подію `roulette.spin`.
- [ ] Реалізація. Запустити `npx jest src/game && npx jest --config ./test/jest-e2e.json` → PASS. Коміт.

### Task 6: `/internal/tick` для Cloud Scheduler

**Files:**
- Create: `server/src/game/tick.controller.ts`, `server/src/game/tick.guard.ts`, `server/src/game/tick.guard.spec.ts`, `server/test/tick.e2e-spec.ts`
- Modify: `server/src/data/repositories.ts` (+ `GroupRepository.listWithGame(statuses: GroupStatus[]): Promise<Group[]>` і контрактний тест), `server/src/game/game.module.ts`, `server/package.json`, `tool/deploy_api.sh`, `docs/deploy.md`

**Interfaces:**
- Produces:
  - `POST /internal/tick` (`@Public()`, свій guard) → `{advanced: number}`. Викликає `advance` для груп зі статусом `draft|active` і `game`.
  - Guard перевіряє Bearer OIDC: `aud = TICK_AUDIENCE`, `email = TICK_INVOKER`, `email_verified`. Без цих змінних маршрут відповідає `404` (вимкнено).
  - Перевірка — через `OidcVerifier` (інтерфейс; Google-реалізація на `google-auth-library` `OAuth2Client.verifyIdToken`), підміняється в тестах.

- [ ] Тести (RED):
  - без змінних → `404`;
  - без токена → `401`;
  - чужий `email` або `aud` → `401`;
  - правильний токен → `200` і клітинки відкриті;
  - повторний виклик → `{advanced}`, без нових подій.
- [ ] Реалізація.
  - `deploy_api.sh` передає `TICK_AUDIENCE` (URL сервісу) і `TICK_INVOKER=commandvibe-scheduler@commandvibe-ks.iam.gserviceaccount.com`.
  - `docs/deploy.md` — кроки власника: створити сервісний акаунт, видати `roles/run.invoker` на сервіс і створити Cloud Scheduler job (щохвилини, OIDC, europe-central2) — точні команди `gcloud`.
- [ ] Повний `server/scripts/check.sh` → усе `ok`. Коміт.

### Task 7: Клієнт — конструктор календаря

**Files:**
- Create:
  - `app/lib/features/calendar/data/calendar_repository.dart`, `app/lib/features/calendar/data/calendar_models.dart`
  - `app/lib/features/calendar/ui/game_setup_view.dart`, `game_setup_view_model.dart`, `calendar_editor_view.dart`, `calendar_editor_view_model.dart`, `catalog_picker_sheet.dart`, `custom_task_sheet.dart`
  - тести `app/test/features/calendar/*`
- Modify: `app/lib/core/router.dart` (`/g/:groupId/setup`), `app/lib/features/groups/ui/group_home_view.dart` (кнопка організатора «Календар гри»), `app/lib/l10n/app_uk.arb`, `app_en.arb`

**Interfaces:**
- Consumes: REST Task 4; `ApiClient`.
- Produces:
  - `CalendarRepository`: `catalog({category, query})`, `saveGame(GameSetup)`, `calendar(groupId)`, `other(day)`, `setTask(day, ref)`, `move(day, to)`;
  - моделі `GameSetup`, `CalendarDay`, `TaskText`.

- [ ] Тести view-model (Fake-репозиторій, RED):
  - валідація форми: 7–31 день, дата не в минулому, щонайменше одна категорія;
  - збереження → список днів;
  - «Інше» замінює лише свій день;
  - помилка `409 day_opened` дає повідомлення, а список перечитується;
  - стрілки «вгору/вниз» викликають `move`;
  - своє завдання — UA обов'язково.
- [ ] Віджет-тести: форма з категоріями-чипами; відкритий день без кнопок зміни.
- [ ] `app/tool/check.sh` → усе `ok`. Коміт.

### Task 8: Клієнт — «Сьогодні» і рулетка

**Files:**
- Create:
  - `app/lib/features/today/data/today_repository.dart`, `today_models.dart`
  - `app/lib/features/today/ui/today_card.dart`, `today_view_model.dart`, `roulette_wheel.dart`, `roulette_motion.dart`
  - тести `app/test/features/today/*`
- Modify: `app/lib/features/groups/ui/group_home_view.dart` (картка «Сьогодні» вгорі), l10n, `tool/e2e_web.mjs` (сценарій: група з грою в режимі `auto` через `/test/seed-group` + `PUT game` → картка дня)
- Modify: `server/src/testing/test-seed.module.ts` — можна передати `game` і час (лише `NODE_ENV=test`).

**Interfaces:**
- Consumes: `GET today`, `POST roulette/spin`, події `day.opened`, `roulette.waiting`, `roulette.spin` (Task 5).
- Produces:
  - `rouletteAngle({required Duration elapsed, required Duration duration, required int doorCount, required int winnerIndex}) -> double` — `easeOutCubic` до `turns * 2π + кут переможця`, `turns = 5`;
  - `RouletteMotion.from(spin, serverOffset, now)` → `(Duration elapsed, bool replay)`. Для пізнього входу — повтор 1500 мс.
  - `TodayViewModel`:
    - стани `notConfigured`, `beforeStart(date)`, `waiting(picker, deadline, isMe)`, `spinning`, `open(task)`, `finished`;
    - `serverOffset = serverTime - локальний час при отриманні`.

- [ ] Тести (RED):
  - `rouletteAngle` при `elapsed=0` дає 0; при `elapsed>=duration` — точно кут переможця (за модулем 2π);
  - **два клієнти з різним локальним часом, але однаковим `serverOffset`-скорегованим часом, мають однаковий кут**;
  - пізній вхід (через 10 с) → `replay` 1500 мс до кута переможця;
  - view-model: подія `roulette.spin` → `spinning`, потім `open`; `isMe` показує кнопку «Крутити»; `403/409` від spin → повідомлення й перечитування.
- [ ] Віджет-тест картки в кожному стані. Сценарій у headless Chrome (`node tool/e2e_web.mjs`) — картка дня з назвою.
- [ ] `app/tool/check.sh` → усе `ok`. Коміт.

### Task 9: Документація, звіт, рев'ю, деплой `candidate`

- [ ] `.agents/rules/project-overview.md`:
  - модуль `game/` і API;
  - моделі `Group.game` і `cells`;
  - події `day.opened`, `roulette.waiting`, `roulette.spin`;
  - `/internal/tick`.
- [ ] Звіт `report/report_YYYYMMDD_HHMM.md`, разом з описом запиту синхронізації (події realtime).
- [ ] Фінальне рев'ю всієї гілки — окремий агент на Opus, з розділом Review Focus. Критичні й важливі зауваження виправляються одним проходом.
- [ ] Злиття в main за постійним дозволом хабу. Деплой ревізії `candidate` без трафіку, перевірки (`/health`, `PUT game` / `GET today` на тестовій групі), потім трафік. Веб — на живий сайт лише з «так» власника. Рядок хабу.
