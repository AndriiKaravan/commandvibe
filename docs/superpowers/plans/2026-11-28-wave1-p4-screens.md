# P4 — Екрани (Сьогодні, Календар, Стрічка, Рейтинг, Я/Група) і аватари — план реалізації

> **Для виконавця:** REQUIRED SUB-SKILL: superpowers:executing-plans (нативно, цей сеанс виконує всі задачі, одне фінальне рев'ю) або superpowers:subagent-driven-development. Кроки — з чекбоксами.

**Goal:** учасник і організатор працюють у застосунку через п'ять вкладок із реальними даними: «Сьогодні» (хід дня, моє місце, події), «Календар» (сітка дверцят), «Стрічка» (фото всіх днів із фільтрами), «Рейтинг» (місця наживо), «Я»/«Група» (аватар, прогрес, керування групою), плюс колекція аватарів.

**Architecture:** сервер додає лише читання поверх наявних даних — `progress`, `feed`, `standings`, вибір аватара; доступ до фото — єдина функція `decidePhotoAccess` через `PhotosService.accessFor` (нових правил доступу немає). Клієнт: оболонка `StatefulShellRoute` (go_router) з нижньою панеллю, на широких екранах — бічна; кожна вкладка — view + ChangeNotifier view-model, живі оновлення — за наявними подіями групи (`submission.*`, `photos.revealed`, `calendar.*`, resync) без нових подій.

**Tech Stack:** NestJS 11 + TS (jest unit + e2e, supertest), Flutter (go_router, ChangeNotifier, ks_core realtime, `FakeRealtimeClient`), l10n ARB UA/EN.

**Spec:** `docs/specs/2026-11-19-photo-challenge-design.md` — розділ 2а (пріоритет), 6а «Екрани», 9 «Бали», «Дошка рейтингу», «Аватари»; roadmap `docs/superpowers/plans/2026-11-26-wave1-roadmap.md` рядок P4.

## Global Constraints

- Усі дані — лише через сервер; клієнт не читає Firestore (2а п. 6).
- Тема «Скло», світла й темна; мобільний вигляд основний, ≥ 840 px — десктопний (бічна навігація, вміст ≤ 640 px по центру) (2а п. 9).
- Рядки лише через ARB (UA і EN з першого дня), згенеровані файли комітяться; код-коментарі — мінімум, англійською.
- Жодного `dart:html`/`package:web` поза `*_web.dart`; кожна задача, що чіпає `app/`, закінчується `app/tool/check.sh` (analyze, test, збірки web/Android/iOS); без симуляторів і емуляторів.
- Сервер: `server/scripts/check.sh`; нові репозиторні методи — у обох реалізаціях (пам'ять + Firestore) із записом у спільний контрактний набір `repositories.contract.ts`.
- Доступ до фото — виключно `decidePhotoAccess`: розмите не дає `photoUrl`, прихований і від учасника, що вилучений, не потрапляє у стрічку.
- Рейтинг показує лише бали й місце; хто що не виконав — не показує (анти-ціль «стеження», розділ 9).
- Не чіпати `ks_core`/`ks_server`. Після змін логіки — `.agents/rules/project-overview.md` (версія, дата) і звіт `report/report_YYYYMMDD_HHMM.md` з повним текстом завдання на початку.
- Подій у realtime нових не додаємо; payload подій не містить URL чи вмісту.

## Рішення, яких немає в дизайні (типові варіанти; власник може змінити)

1. **Бали в P4** — лише база «10 за виконане фото»; швидкість, пізнє виконання, лайки й журнал — P5. Ендпоінт `standings` стабільний: P5 міняє обчислення, не форму відповіді.
2. **Приховане організатором фото** не рахується ні в прогресі дня, ні в балах, і не показується у стрічці (учасник бачить свій стан «приховано» як зараз у дні).
3. **«Події» на «Сьогодні»** — лише з realtime-подій, що прийшли за час відкритого застосунку («Олена виконала», «фото за 1 грудня відкрились»); серверного журналу подій у P4 немає.
4. **Аватари** — 24 вбудовані (іконка Material + колір, ідентифікатори `av01…av24`), як тимчасова колекція; власні ілюстрації підміняються за тими ж id без змін API. Типовий аватар — кружечок з ініціалами.
5. **П'ята вкладка**: для учасника «Я», для організатора «Група» (угорі його власний профіль, нижче керування групою).
6. **Спільна ціль 80%** — лише смужка прогресу дня; бонус +3 — P5.
7. **Стрічка**: сторінка 20 елементів, найновіші згори; фільтри «день», «учасник», «мої»; лайків і коментарів немає до P5.
8. **Редактор календаря** організатора лишається за `/g/:groupId/calendar`; вкладка «Календар» — `/g/:groupId/days`.
9. **Перевірка сценарію дня** — скрипт `tool/e2e_web.mjs` у headless Chrome (у roadmap `integration_test` — без симуляторів недоступний); пристрої власника — вручну в кінці хвилі.
10. **Місце й рейтинг ділять рівні бали** («1, 2, 2, 4»); порядок усередині рівних — за іменем.

## Review Focus

Що план вважає найімовірнішим джерелом помилок, тести яких задачі нижче закривають:

1. Стрічка не віддає `photoUrl` розмитих; не містить прихованих, фото вилучених і ще не активних учасників (Task 2).
2. Курсор стрічки стабільний, коли під час гортання з'являються нові фото (немає дублів і пропусків) (Task 2).
3. Календар учаснику не видає завдань майбутніх днів, але прогрес сітки (виконано/можна/розкрито) правильний на межі 9:00 і дня (Task 1, Task 8).
4. Невідомий `avatar` → `400`; чужий аватар змінити неможливо; вилучений учасник не потрапляє у рейтинг (Task 3, Task 4).
5. Рівні бали, порожня група, один учасник, організатор, що не грає — рейтинг і «моє місце» не падають і не показують зайвого (Task 4, Task 9).

---

## Файлова структура

**Сервер (створити):** `server/src/progress/` (`progress.service.ts`, `progress.controller.ts`, `progress.module.ts`, `views.ts`, спеки), `server/src/feed/` (`feed.service.ts`, `feed.controller.ts`, `feed-cursor.ts`, `feed.module.ts`, спеки), `server/src/standings/` (`standings.service.ts`, `standings.controller.ts`, `standings.module.ts`, спеки), `server/src/members/avatars.ts`, `server/test/progress.e2e-spec.ts`, `server/test/feed.e2e-spec.ts`, `server/test/standings.e2e-spec.ts`, `server/test/avatar.e2e-spec.ts`.
**Сервер (змінити):** `server/src/data/repositories.ts` (+ `SubmissionRepository.listByGroup`), `memory/memory-repositories.ts`, `firestore/firestore-repositories.ts`, `repositories.contract.ts`, `server/src/members/members.controller.ts` + `members.service.ts` (аватар), `server/src/photos/views.ts` + `photos.service.ts` (аватар автора в елементах), `server/src/app.module.ts`.
**Клієнт (створити):** `app/lib/core/ui/adaptive_shell.dart`, `app/lib/features/shell/` (`group_shell.dart`), `app/lib/features/avatars/` (`avatar_catalog.dart`, `member_avatar.dart`, `avatar_picker_sheet.dart`, `avatar_repository` у `groups`-репозиторії), `app/lib/features/progress/` (data + `day_progress_card.dart`), `app/lib/features/standings/` (data, view-model, `standings_view.dart`, `my_place_card.dart`), `app/lib/features/feed/` (data, view-model, `feed_view.dart`), `app/lib/features/calendar/ui/days_view.dart` + `days_view_model.dart` + `day_sheet.dart`, `app/lib/features/profile/` (`profile_view.dart`, `profile_view_model.dart`), `app/lib/features/today/ui/events_card.dart`.
**Клієнт (змінити):** `core/router.dart` (оболонка), `features/groups/ui/group_home_view.dart` (розбити: керування групою → вкладка), `features/photos/ui/photo_viewer_view.dart` (гортання), `core/services_scope.dart`, ARB uk/en + згенеровані, `app/tool/check.sh` не чіпаємо.
**Документація:** `.agents/rules/project-overview.md`, `report/`.

---

### Task 1: Сервер — прогрес гри (`GET /groups/:id/progress`)

**Files:**
- Modify: `server/src/data/repositories.ts`, `data/memory/memory-repositories.ts`, `data/firestore/firestore-repositories.ts`, `data/repositories.contract.ts`
- Create: `server/src/progress/progress.service.ts`, `progress.controller.ts`, `progress.module.ts`, `views.ts`, `progress.service.spec.ts`; `server/test/progress.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `GroupsService.getFor(subject, groupId)`, `SubmissionRepository`, `MemberRepository.list`, `CellRepository.list`, `PhotosService.viewerOf(subject, groupId)` (розпізнає учасника і організатора-гравця).
- Produces: `SubmissionRepository.listByGroup(groupId: string): Promise<Submission[]>`; `GET /groups/:id/progress` → `ProgressView { days: { dayIndex: number; done: number; total: number; mine: boolean | null }[]; serverTime: string }` — `done` не враховує `hidden`; `total` = активні гравці (учасники + організатор, якщо грає); `mine` = `null` для організатора, що не грає.

- [ ] **Step 1: Контрактні тести** `listByGroup` у `repositories.contract.ts`: повертає фото всіх днів і учасників лише цієї групи, не повертає чужі групи (спільний набір для пам'яті й емулятора).
- [ ] **Step 2: Run:** `cd server && npx jest src/data` — Expected: FAIL (`listByGroup` не існує).
- [ ] **Step 3: Implement** `listByGroup` в обох репозиторіях (Firestore — запит по колекції `submissions` групи; шлях узяти з наявних `get/listDay`).
- [ ] **Step 4: Unit-тести** `progress.service.spec.ts`: порожня гра; приховане не рахується; `total` не включає `pending`/`removed`; `mine` true/false/null; дні без фото дають `done: 0`.
- [ ] **Step 5: Implement** `ProgressService.progressFor(subject, groupId): Promise<ProgressView>` + контролер (`@Get('groups/:id/progress')`, `IdPipe`), модуль у `app.module.ts`.
- [ ] **Step 6: e2e** `progress.e2e-spec.ts`: учасник бачить свій `mine`, чужа група → `403`, без сесії `401`, організатор без гри → `mine: null`.
- [ ] **Step 7: Run:** `cd server && npx jest src/data src/progress && npx jest --config test/jest-e2e.json test/progress` — Expected: PASS.
- [ ] **Step 8: Commit** `feat(progress): per-day completion counts`.

---

### Task 2: Сервер — стрічка (`GET /groups/:id/feed`)

**Files:**
- Create: `server/src/feed/feed-cursor.ts`, `feed.service.ts`, `feed.controller.ts`, `feed.module.ts`, `feed.service.spec.ts`, `feed-cursor.spec.ts`; `server/test/feed.e2e-spec.ts`
- Modify: `server/src/photos/views.ts` (поле `avatar` в елементі), `server/src/app.module.ts`

**Interfaces:**
- Consumes: `SubmissionRepository.listByGroup`, `PhotosService.accessFor`, функція побудови елемента з `photos/views.ts` (та сама форма, що в `GET …/days/:day/submissions`: `access`, `photoUrl`, `blurUrl`, `mine`, `moderation`), `PhotoUrlSigner`.
- Produces: `GET /groups/:id/feed?day=<n>&memberId=<id>&mine=1&limit=<1..50, default 20>&before=<cursor>` → `{ items: FeedItem[]; next?: string; serverTime: string }`; `FeedItem` = елемент дня + `dayIndex`, `taskTitle` (для відкритого завдання; без назви, якщо учаснику вона ще не видима). Порядок: `submittedAt` спадно, тай-брейк `dayIndex` спадно, `memberId`. Курсор — непрозорий рядок `encodeCursor({submittedAt, dayIndex, memberId})` / `decodeCursor(raw): Cursor | undefined` (поганий → `400 invalid_cursor`).

- [ ] **Step 1: Тест курсора** `feed-cursor.spec.ts`: кругова пара encode/decode; сміття, обрізаний, чужий формат → `undefined`.
- [ ] **Step 2: Unit-тести** `feed.service.spec.ts` (Review Focus 1–2): розмите не має `photoUrl`; приховане й фото не активного учасника відсутні (навіть для організатора — він бачить їх у скаргах, не в стрічці); сторінки по 2 при трьох фото дають без дублів/пропусків, навіть коли між запитами додано нове фото (курсор не зсувається); фільтри `day`, `memberId`, `mine`; `mine` для організатора без гри → порожньо; невідомий `day` → `400`.
- [ ] **Step 3: Run:** `cd server && npx jest src/feed` — Expected: FAIL.
- [ ] **Step 4: Implement** `feed-cursor.ts` і `FeedService.page(subject, groupId, query): Promise<FeedPage>` (бере `listByGroup`, фільтрує приховані/неактивних, сортує, ріже за курсором, будує елементи через `accessFor` і ті самі view-функції фото); контролер із валідацією `limit`.
- [ ] **Step 5: e2e** `feed.e2e-spec.ts`: два учасники; Б до свого виконання бачить фото А розмитим без `photoUrl`; після — повним; організатор ховає фото → зникає зі стрічки; чужа група `403`; `before` з сміттям `400`.
- [ ] **Step 6: Run:** `cd server && npx jest src/feed && npx jest --config test/jest-e2e.json test/feed` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(feed): paginated photo feed with the shared access matrix`.

---

### Task 3: Сервер — аватари (`PUT /groups/:id/me/avatar`)

**Files:**
- Create: `server/src/members/avatars.ts`, `avatars.spec.ts`; `server/test/avatar.e2e-spec.ts`
- Modify: `server/src/members/members.service.ts`, `members.controller.ts`, `server/src/photos/views.ts` (віддати `avatar` автора), `server/src/photos/photos.service.ts` (передати)

**Interfaces:**
- Consumes: `PhotosService.viewerOf(subject, groupId)` → `{ memberId, … }`, `MemberRepository.update`.
- Produces: `avatarIds: readonly string[]` (`av01…av24`), `isAvatarId(value: unknown): value is string`; `PUT /groups/:id/me/avatar` body `{ avatar: string | null }` → `204`; `null` повертає ініціали. Невідомий id → `400 invalid_avatar`. `MemberView.avatar` і елементи дня/стрічки віддають `avatar`.

- [ ] **Step 1: Тести** `avatars.spec.ts` (24 унікальні id, формат) і e2e (Review Focus 4): учасник міняє свій; невідомий id `400`; організатор-гравець міняє свій; організатор, що не грає → `403 not_playing`; в `GET members` і в списку дня з'являється `avatar`; чужий `memberId` у шляху немає (змінюється лише власний).
- [ ] **Step 2: Run:** `cd server && npx jest src/members/avatars && npx jest --config test/jest-e2e.json test/avatar` — Expected: FAIL.
- [ ] **Step 3: Implement** `avatars.ts`, `MembersService.setAvatar(subject, groupId, avatar)`, маршрут, додавання `avatar` у view-функції фото.
- [ ] **Step 4: Run** ті самі команди — Expected: PASS.
- [ ] **Step 5: Commit** `feat(members): avatar choice from a fixed collection`.

---

### Task 4: Сервер — рейтинг (`GET /groups/:id/standings`)

**Files:**
- Create: `server/src/standings/standings.service.ts`, `standings.controller.ts`, `standings.module.ts`, `standings.service.spec.ts`; `server/test/standings.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `SubmissionRepository.listByGroup`, `MemberRepository.list`, `PhotosService.viewerOf`.
- Produces: `GET /groups/:id/standings` → `{ items: { memberId; displayName; avatar?: string; points: number; rank: number; mine: boolean }[]; me?: { rank: number; points: number; toNext?: number }; serverTime }`. `points` = 10 × число не прихованих виконань (рішення 1–2); `rank` — «1,2,2,4» (рішення 10); у список входять лише активні гравці; `me` відсутнє для організатора, що не грає; `toNext` — скільки балів до сусіда зверху (немає в лідера).

- [ ] **Step 1: Unit-тести** (Review Focus 4–5): порожня група → `items: []`; один учасник → `rank 1`, без `toNext`; рівні бали ділять місце, порядок за іменем; приховане фото не додає балів; вилучений/`pending` відсутні; організатор, що не грає, не у списку й без `me`; `toNext` рахується до першого, хто вище.
- [ ] **Step 2: Run:** `cd server && npx jest src/standings` — Expected: FAIL.
- [ ] **Step 3: Implement** `StandingsService.standings(subject, groupId)` + контролер + модуль.
- [ ] **Step 4: e2e** `standings.e2e-spec.ts`: двоє виконали — обидва `rank` за балами; після прихованого фото бали падають; `403` для чужої групи, `401` без сесії.
- [ ] **Step 5: Run:** `cd server && npx jest src/standings && npx jest --config test/jest-e2e.json test/standings && ./scripts/check.sh` — Expected: PASS, `check.sh` усі `ok`.
- [ ] **Step 6: Commit** `feat(standings): base-points ranking with shared ranks`.

---

### Task 5: Клієнт — оболонка з вкладками і навігація

**Files:**
- Create: `app/lib/core/ui/adaptive_shell.dart`, `app/lib/features/shell/group_shell.dart`; `app/test/features/shell/group_shell_test.dart`
- Modify: `app/lib/core/router.dart`, `app/lib/features/groups/ui/group_home_view.dart` (залишити як вкладку «Група»/«Я» у Task 12; тут — тимчасово вкладки-заглушки), ARB uk/en

**Interfaces:**
- Produces: `AdaptiveShell({ required StatefulNavigationShell shell, required List<ShellTab> tabs })` — нижня `NavigationBar` до 840 px, `NavigationRail` від; `ShellTab({ required String label, required IconData icon })`. Маршрути в `/g/:groupId`: гілки `today`, `days`, `feed`, `rating`, `me` (лише одна гілка `me` — підпис «Група» для власника, «Я» для учасника). `/g/:groupId` переспрямовує на `/g/:groupId/today`. Збережені маршрути `/g/:id/photo/…`, `/complaints`, `/calendar`, `/setup`, `/invite` лишаються поверх оболонки.
- Consumes: сесія (`StoredSession.isOrganizer`) для підпису п'ятої вкладки.

- [ ] **Step 1: Widget-тест** `group_shell_test.dart`: п'ять вкладок; підпис п'ятої «Група» для власника й «Я» для учасника; на ширині 1000 px — `NavigationRail`, на 400 — `NavigationBar`; вибір вкладки міняє гілку й зберігає стан попередньої.
- [ ] **Step 2: Run:** `cd app && flutter test test/features/shell` — Expected: FAIL.
- [ ] **Step 3: Implement** `AdaptiveShell`, `GroupShell`, маршрути (`StatefulShellRoute.indexedStack`), редирект `/g/:id` → `today`, ARB-рядки назв вкладок (UA: «Сьогодні», «Календар», «Стрічка», «Рейтинг», «Я», «Група»).
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS, без зауважень.
- [ ] **Step 5: Commit** `feat(app): five-tab group shell`.

---

### Task 6: Клієнт — аватари (каталог, віджет, вибір)

**Files:**
- Create: `app/lib/features/avatars/avatar_catalog.dart`, `member_avatar.dart`, `avatar_picker_sheet.dart`, `avatar_picker_view_model.dart`; тести `app/test/features/avatars/*`
- Modify: `app/lib/features/groups/data/groups_repository.dart` (`setAvatar(groupId, avatar)`, `GroupMember.avatar`), `features/photos/data/photos_models.dart` (`avatar` у `SubmissionItem`), фейки репозиторіїв у тестах, ARB

**Interfaces:**
- Produces: `AvatarCatalog.ids` (ті самі `av01…av24`, що на сервері; тест звіряє довжину й унікальність), `AvatarCatalog.styleOf(String id): AvatarStyle { IconData icon; Color color }`; `MemberAvatar({ required String displayName, String? avatar, double size = 40 })` — ініціали (до двох літер), якщо `avatar` порожній або невідомий; `GroupsRepository.setAvatar(String groupId, String? avatar): Future<void>`; `AvatarPickerSheet.show(context, { required String? current, required Future<void> Function(String? id) onPick })`.
- Consumes: `PUT /groups/:id/me/avatar` (Task 3).

- [ ] **Step 1: Тести:** ініціали (одне слово, два слова, емодзі/кирилиця, порожнє ім'я → «?»); невідомий `avatar` → ініціали; каталог: 24 унікальні id; `AvatarPickerViewModel`: вибір викликає `setAvatar`, помилка не змінює поточний, повторне натискання під час запиту ігнорується.
- [ ] **Step 2: Run:** `cd app && flutter test test/features/avatars` — Expected: FAIL.
- [ ] **Step 3: Implement** каталог (24 пари «іконка + колір»), `MemberAvatar`, view-model і шторку вибору, `setAvatar` у API-репозиторії.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): avatar collection and picker`.

---

### Task 7: Клієнт — вкладка «Сьогодні» (хід дня, моє місце, події)

**Files:**
- Create: `app/lib/features/progress/data/progress_models.dart`, `progress_repository.dart`, `day_progress_card.dart`, `progress_view_model.dart`; `app/lib/features/standings/data/standings_models.dart`, `standings_repository.dart`, `my_place_card.dart`; `app/lib/features/today/ui/events_card.dart`, `events_view_model.dart`; тести
- Modify: `app/lib/core/services_scope.dart`, `features/today/ui/today_card.dart` (залишається картка завдання + фото дня), router (гілка `today` = `TodayTab`), ARB

**Interfaces:**
- Consumes: `GET /groups/:id/progress` (Task 1), `GET /groups/:id/standings` (Task 4), наявні `TodayViewModel`, `DayPhotosCard`, realtime `group:<id>`.
- Produces: `ProgressRepository.progress(groupId): Future<GameProgress>`, `StandingsRepository.standings(groupId): Future<Standings>`; `ProgressViewModel`/`StandingsViewModel` — завантажують при `start()`, перечитують на `submission.*`, `photos.revealed`, resync; `EventsViewModel` — список `GameEvent { kind, text args, at }` лише з realtime-подій відкритого застосунку (макс. 20); порядок блоків «Сьогодні»: завдання → рулетка → «7 з 12 виконали» зі смужкою до 80% → фото дня → «Моє місце» і три лідери → події.

- [ ] **Step 1: Тести view-model** із `FakeRealtimeClient` і фейковими репозиторіями: перше завантаження; перечитування на `submission.created`; помилка мережі лишає старі дані й `loadFailed`; `EventsViewModel` додає подію на `photos.revealed`, обрізає до 20; `MyPlaceCard` для організатора без гри (немає `me`) нічого не малює.
- [ ] **Step 2: Widget-тести** станів `DayProgressCard` (0 з N; 80% досягнуто — смужка заповнена й підпис; N = 0) і `MyPlaceCard` («ти 4-й, до 3-го — 6 балів», лідер без «до»).
- [ ] **Step 3: Run:** `cd app && flutter test test/features/progress test/features/standings test/features/today` — Expected: FAIL.
- [ ] **Step 4: Implement** моделі, репозиторії (+ реєстрація в `AppServices`), view-model, картки, `TodayTab` зі збором блоків, ARB-рядки.
- [ ] **Step 5: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(app): today tab with day progress, my place and live events`.

---

### Task 8: Клієнт — вкладка «Календар» (сітка дверцят, день)

**Files:**
- Create: `app/lib/features/calendar/ui/days_view.dart`, `days_view_model.dart`, `day_sheet.dart`, `day_state.dart`; тести `app/test/features/calendar/days_*_test.dart`
- Modify: router (гілка `days`), ARB; використовує `CalendarRepository.calendar`, `ProgressRepository`, `PhotosRepository.day`

**Interfaces:**
- Produces: `DayCellState { closed, open, doneOnTime, canStillDo, revealed }` і чиста функція `dayCellState({ required DayView day, required bool? mine, required DateTime now, required DateTime? revealAt }): DayCellState`; `DaysViewModel` (календар + прогрес, перечитування на `calendar.*`, `submission.*`, `photos.revealed`, resync); `DaySheet` — завдання (якщо видиме), моє фото або «Виконати» (через наявну шторку надсилання), усі фото дня (`DayPhotosSection`), для пізнього виконання — підпис про бали не показуємо до P5 (лише «ще можна виконати»).
- Consumes: `GET /groups/:id/calendar`, `GET /groups/:id/progress`, дні/фото з P3.

- [ ] **Step 1: Тести `dayCellState`** (Review Focus 3): майбутній день → `closed`; відкритий без мого фото → `canStillDo`; з фото до розкриття → `doneOnTime`; після `revealAt` → `revealed`; межа рівно о `revealAt`; організатор, що не грає (`mine == null`) → без станів «моє».
- [ ] **Step 2: Тести `DaysViewModel`:** завантаження, оновлення на події, помилка мережі; учасник не отримує завдань закритих днів у моделі.
- [ ] **Step 3: Widget-тести:** сітка малює N дверцят зі станами; дотик до закритого не відкриває завдання; дотик до відкритого відкриває `DaySheet`.
- [ ] **Step 4: Run:** `cd app && flutter test test/features/calendar` — Expected: FAIL.
- [ ] **Step 5: Implement** функцію, view-model, сітку (адаптивна кількість колонок), шторку дня, ARB-рядки станів.
- [ ] **Step 6: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(app): calendar tab with door grid and day sheet`.

---

### Task 9: Клієнт — вкладка «Стрічка» і гортання на весь екран

**Files:**
- Create: `app/lib/features/feed/data/feed_models.dart`, `feed_repository.dart`, `feed_view.dart`, `feed_view_model.dart`, `feed_filters_bar.dart`; тести `app/test/features/feed/*`
- Modify: `app/lib/features/photos/ui/photo_viewer_view.dart` (+ `photo_viewer_view_model` за потреби: `PageView` між фото одного дня), router (гілка `feed`), ARB

**Interfaces:**
- Consumes: `GET /groups/:id/feed` (Task 2), `BlurredPhotoTile`, наявний `PhotoViewerBody`.
- Produces: `FeedRepository.page(groupId, { int? day, String? memberId, bool mine = false, String? before, int limit = 20 }): Future<FeedPage { items, next }>`; `FeedViewModel` — `items`, `loadMore()` (ігнорує повтор, коли `next == null` або вантаження триває), `setFilter(FeedFilter)` (скидає список), перезавантаження першої сторінки на `submission.*`/`photos.revealed`/resync; `PhotoViewerView` отримує список фото дня (`DaySubmissions.items`, що мають `photoUrl`) і гортає горизонтально; відкриття за `memberId` стартує з потрібної сторінки.

- [ ] **Step 1: Тести `FeedViewModel`:** перша сторінка; `loadMore` додає без дублів; повторний `loadMore` під час вантаження — один запит; кінець списку (`next == null`); зміна фільтра скидає; подія `submission.created` перезавантажує першу сторінку, не втрачаючи вже відкритих; помилка мережі лишає список.
- [ ] **Step 2: Widget-тести:** елемент розмитий показує `BlurredPhotoTile` і нічого, крім напису (без спроби вантажити `photoUrl`); відкритий — зображення; порожня стрічка → текст «Поки немає фото»; гортання у viewer міняє автора й лишається в межах дня.
- [ ] **Step 3: Run:** `cd app && flutter test test/features/feed test/features/photos` — Expected: FAIL.
- [ ] **Step 4: Implement** моделі, репозиторій, view-model, список зі «пагінацією за прокруткою», панель фільтрів («день», «учасник», «мої»), `PageView` у viewer, ARB-рядки.
- [ ] **Step 5: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(app): feed tab with filters and swipe viewer`.

---

### Task 10: Клієнт — вкладка «Рейтинг»

**Files:**
- Create: `app/lib/features/standings/ui/standings_view.dart`, `standings_row.dart`, `rank_trend.dart`; тести `app/test/features/standings/*`
- Modify: router (гілка `rating`), ARB; використовує `StandingsViewModel` з Task 7

**Interfaces:**
- Consumes: `StandingsViewModel` (`items`, `me`).
- Produces: `RankTrend.between(List<StandingItem> previous, List<StandingItem> next): Map<String, int>` — зсув місця за `memberId` (додатне = піднявся); `StandingsView` — рядки (місце, `MemberAvatar`, ім'я, бали, «↑2»/«↓1» поруч до наступного оновлення), плавна зміна порядку (`AnimatedList`/`AnimatedSwitcher` за ключем `memberId`), рядок «мій» підсвічений; порожній стан «Поки немає балів».

- [ ] **Step 1: Тести `RankTrend`:** піднявся/впав/без змін; новий учасник без стрілки; рівні місця; порожні списки.
- [ ] **Step 2: Widget-тести:** рейтинг малює усіх із балами; «мій» рядок відмічений; порожній стан; оновлення з переставленими рядками показує стрілку.
- [ ] **Step 3: Run:** `cd app && flutter test test/features/standings` — Expected: FAIL.
- [ ] **Step 4: Implement** `RankTrend`, рядки, анімацію, ARB; підключити живе оновлення (`StandingsViewModel` вже слухає події).
- [ ] **Step 5: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(app): live rating tab`.

---

### Task 11: Клієнт — вкладка «Я» / «Група»

**Files:**
- Create: `app/lib/features/profile/profile_view.dart`, `profile_view_model.dart`, `group_tools_section.dart`; тести `app/test/features/profile/*`
- Modify: `app/lib/features/groups/ui/group_home_view.dart` (вміст керування групою переїжджає в `GroupToolsSection`; сам екран зникає як окремий маршрут), router (гілка `me`), ARB

**Interfaces:**
- Consumes: `GroupsRepository.members/approve/remove`, `setAvatar`, `StandingsViewModel.me`, `ProgressViewModel`, наявні `ComplaintsButton`, `InviteView`, `GameSetupView`, календарний редактор, `PUT /me/pin`, `sessions.clear()`.
- Produces: `ProfileView({ required String groupId, required bool isOwner })`: угорі `MemberAvatar` з кнопкою «Змінити» (`AvatarPickerSheet`), ім'я, «Мої бали» та «виконано днів N з M»; зміна PIN (наявний екран/шторка); для власника нижче `GroupToolsSection` (учасники в очікуванні, запросити, календар-редактор, налаштування гри, скарги, «Мої групи»); «Вийти» для всіх. Організатор, що не грає, не бачить блоків «мої бали/аватар».

- [ ] **Step 1: Тести `ProfileViewModel`:** завантаження імені й балів; вибір аватара оновлює стан; помилка не змінює; для організатора без гри — немає `me`.
- [ ] **Step 2: Widget-тести:** учасник бачить «Я» без інструментів групи; власник бачить інструменти; кнопка «Вийти» очищає сесію (з фейковим `SessionStore`).
- [ ] **Step 3: Run:** `cd app && flutter test test/features/profile test/features/groups` — Expected: FAIL.
- [ ] **Step 4: Implement** екран, секцію інструментів (перенести без зміни поведінки код очікуючих/відхилення з `group_home_view.dart`; зберегти реакцію на `revoked` — очистити сесію, `authChanged()`, перейти на `/` — тепер у спільній оболонці `GroupShell`, щоб вона діяла з будь-якої вкладки; додати тест на це), ARB.
- [ ] **Step 5: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(app): profile and group tools tab`.

---

### Task 12: Наскрізна перевірка, документація, звіт

**Files:**
- Modify: `tool/e2e_web.mjs` (+ сценарій вкладок), `.agents/rules/project-overview.md`, `report/report_<дата_час>.md`

**Interfaces:**
- Consumes: усе з Task 1–11.

- [ ] **Step 1: Розширити `tool/e2e_web.mjs`** сценарієм: два учасники; А виконує — Б у «Стрічці» бачить розмите; Б виконує — бачить повне; «Рейтинг» показує обох; «Календар» показує день 0 зі станом; зміна аватара відображається в стрічці й рейтингу. Запуск за наявним рецептом (тестовий сервер `STORAGE=memory NODE_ENV=test`).
- [ ] **Step 2: Run:** `cd server && ./scripts/check.sh` і `cd app && ./tool/check.sh` і e2e-скрипт — Expected: усе `ok`.
- [ ] **Step 3: Документація:** `project-overview.md` (версія, нові маршрути API, вкладки), звіт з повним текстом завдання, запитом синхронізації клієнта (які читання на які події), рішеннями 1–10.
- [ ] **Step 4: Контрактні набори на емуляторі** (Docker, як у P3) для нового `listByGroup` — Expected: усі проходять.
- [ ] **Step 5: Commit** `docs(p4): overview, report and e2e flow`.

---

## Самоперевірка плану

- **Покриття спеки 6а:** «Сьогодні» (Task 7: завдання/рулетка/фото вже є, хід дня, моє місце, події); «Календар» (Task 8); «Стрічка» (Task 2, 9; лайки/коментарі — P5); «Рейтинг» (Task 4, 10; призи — пізніше); «Я/Група» (Task 11); аватари (Task 3, 6). «Перегляди», «штурхнути», лайки — поза P4 за roadmap.
- **Узгодженість типів:** `listByGroup`, `ProgressView`, `FeedItem`, `StandingItem`, `avatarIds` ↔ `AvatarCatalog.ids` — одні назви в серверних і клієнтських задачах.
- **Пропорція:** серверні задачі закінчуються `check.sh`, клієнтські — `check.sh` застосунку лише в Task 12 та після кожної `flutter analyze/test`; збірки платформ — у Task 12 і перед фінальним рев'ю.
