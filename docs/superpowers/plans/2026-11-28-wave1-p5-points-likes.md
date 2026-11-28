# P5 — Лайки, коментарі, журнал балів і живий рейтинг — план реалізації

> **Для виконавця:** REQUIRED SUB-SKILL: superpowers:executing-plans (нативно, цей сеанс виконує всі задачі, одне фінальне рев'ю) або superpowers:subagent-driven-development. Кроки — з чекбоксами.

**Goal:** гравці лайкають і коментують відкриті фото; бали рахуються за таблицею розділу 9 з видимим журналом «звідки бали»; рейтинг оновлюється наживо за новими правилами; організатор може сховати імена лайкнувших.

**Architecture:** журнал балів — чиста функція `computePoints` над виконаннями, лайками й клітинками (без окремої колекції подій: «правила можна змінити й перерахувати», розділ 9); `standings` і `points` читають її результат. Лайки й коментарі — нові репозиторії (пам'ять + Firestore, спільний контракт), доступ до них — через наявний `PhotosService.accessFor`/`decidePhotoAccess`. Клієнт доповнює картку стрічки й перегляд фото, додає екран журналу балів; живі оновлення — наявним `LiveLoader` на нові події.

**Tech Stack:** NestJS 11 + TS (jest unit + e2e, supertest), Flutter (go_router, ChangeNotifier, ks_core realtime), l10n ARB UA/EN.

**Spec:** `docs/specs/2026-11-19-photo-challenge-design.md` — 2а (пріоритет), 6а «Стрічка — як Instagram» і «Хто що бачить про дії інших», 9 «Бали» («Глядацькі симпатії», «Журнал балів»), «Дошка рейтингу наживо», 11 (видалення даних учасника), 12 (модель даних: `likes`, `comments`, `points`, `standings`); roadmap `docs/superpowers/plans/2026-11-26-wave1-roadmap.md` рядок P5.

## Global Constraints

- Усі дані — лише через сервер; доступ до лайків і коментарів — тільки до фото, яке глядач бачить повністю (`decidePhotoAccess`), ніколи — до розмитих, прихованих, фото неактивних авторів (2а, розділ 12).
- Свої фото лайкати не можна; лайк можна зняти — бали перераховуються (розділ 9).
- «Лише кількість лайків» (`settings.likesCountOnly`): імен лайкнувших не бачить ніхто, і автор теж; у відповідях і подіях імен немає.
- Рейтинг і журнал показують лише бали й місце; хто що не виконав — не показують (анти-ціль «стеження»).
- Realtime-події не містять імен, текстів і URL; лише ідентифікатори й день.
- Рядки лише через ARB (UA і EN); згенеровані файли комітяться; код-коментарі — мінімум, англійською.
- Сервер: `server/scripts/check.sh`; нові репозиторні методи — в обох реалізаціях і в `repositories.contract.ts`. Застосунок: `app/tool/check.sh` (analyze, test, збірки web/Android/iOS); без симуляторів.
- Не чіпати `ks_core`/`ks_server`. Після змін логіки — `.agents/rules/project-overview.md` і звіт `report/report_YYYYMMDD_HHMM.md` з повним текстом завдання.

## Таблиця балів (розділ 9) і що входить у P5

| Рядок таблиці | Бали | P5 |
|---|---|---|
| Виконання в день завдання | 10 | так (`done`) |
| Швидкість 1-й / 2-й / 3-й | +5 / +3 / +2 | так (`speed`) |
| Пізнє виконання (до кінця челенджу) | −2 за кожен день запізнення, не менше 4 | так (`late`) |
| Глядацькі симпатії | `floor(5 × лайки / (гравців − 1))`, не більше 5 за фото | так (`sympathy`) |
| Спільна ціль: 80% групи виконали | +3 кожному, хто виконав | так (`goal`) |
| Раптова клітинка, джокер «подвоєння» ×2 | ×2 до бази | ні — джокери й «раптова клітинка» не в P5 |
| Фінал: «Приз глядацьких симпатій» | +15 | ні — фінал не в P5 |

## Рішення, яких немає в дизайні (типові варіанти; власник може змінити)

1. **Журнал рахується на льоту** з виконань, лайків і клітинок (чиста функція), окремої колекції `points` немає: правила можна змінити без міграції.
2. **«У день завдання»** — виконання не пізніше ніж за 24 год після відкриття клітинки (`opensAt + 24 год`); кожна доба запізнення після цього — −2 до 10, але не нижче 4 (журнал: `done +10` і `late −N`). Час виконання — час першого завантаження (заміна фото його не міняє).
3. **Швидкість** — перші троє, хто виконав у день завдання (за часом першого завантаження, при рівності — за id); пізні й приховані організатором не беруть участі.
4. **Заміна фото** прибирає лайки й коментарі під ним (це вже інше фото); бали перераховуються.
5. **Приховане організатором фото** і фото вилученого учасника не дають балів, не рахуються й лайки вилучених.
6. **Спільна ціль** рахується наживо від поточної кількості активних гравців і всіх виконань дня (пізні теж); +3 кожному, хто виконав цей день.
7. **Лайкнути** може лише гравець (учасник або організатор, що грає), і лише фото, яке бачить повністю; організатор, що не грає, не лайкає й не коментує, але може видаляти коментарі.
8. **Коментарі:** простий текст до 500 символів (обрізаний за пробілами, порожні — `400`), від найстаріших; автор видаляє свій, організатор — будь-який. **Скарги на коментарі в P5 немає** (лишається видалення організатором; скарга на фото вже є).
9. **Прихильники** — різні активні гравці, що лайкнули хоч одне видиме фото автора; показуються числом у профілі й у рейтингу (навіть при «лише кількість лайків»).
10. **При «лише кількість лайків»** кількість лайків видно всім, імен немає нікому; перемикач — `PATCH /groups/:id/settings` (організатор), на екрані «Група».
11. **Нові події** в `group:<id>`: `like.changed` і `comment.created|deleted` (лише `dayIndex`, `memberId` автора фото); клієнтські списки перечитуються на них.
12. **Видалення даних учасника** (вилучення) прибирає його лайки, коментарі й лайки/коментарі під його фото.

## Review Focus

1. Лайки й коментарі недоступні для розмитого, прихованого, власного (лайк), чужої групи й фото неактивного автора; при `likesCountOnly` імен немає ні у відповідях, ні в подіях, і автор їх теж не бачить (Task 2, 3, 5).
2. Бали не рахуються двічі: заміна фото, приховане фото, вилучений учасник, лайки вилучених, рівні часи для швидкості (Task 1, 4).
3. Межа запізнення: рівно `opensAt + 24 год` ще вчасно, +1 мс — вже доба запізнення; мінімум 4 (Task 1).
4. Симпатії: група з 2 гравців (ділення на 1), з 1 гравцем (без ділення на нуль), лайк від себе й від неактивного не рахується (Task 1).
5. Коментар: порожній, лише пробіли, 500/501 символ, юнікод/емодзі, видалення чужого (автор vs організатор vs інший учасник) (Task 3).

---

## Файлова структура

**Сервер (створити):** `server/src/points/` (`points-engine.ts`, `points-engine.spec.ts`, `points.service.ts`, `points.controller.ts`, `points.module.ts`, `views.ts`), `server/src/likes/` (`likes.service.ts`, `likes.controller.ts`, `likes.module.ts`, specs), `server/src/comments/` (`comments.service.ts`, `comments.controller.ts`, `comments.module.ts`, specs), тести `server/test/likes.e2e-spec.ts`, `comments.e2e-spec.ts`, `points.e2e-spec.ts`, `settings.e2e-spec.ts`.
**Сервер (змінити):** `data/models.ts` (`Like`, `Comment`), `data/repositories.ts` (`LIKES`, `COMMENTS`, `LikeRepository`, `CommentRepository`), `data/memory/*`, `data/firestore/*`, `data/data.module.ts`, `data/repositories.contract.ts`, `photos/views.ts` + `photos/photos.service.ts` (лічильники й `likedByMe`, чищення при заміні), `members/members.service.ts` (чищення при вилученні), `standings/standings.service.ts` (журнал), `groups/groups.controller.ts` + `groups.service.ts` (налаштування), `app.module.ts`.
**Клієнт (створити):** `app/lib/features/likes/` (data + `like_button.dart`, `likers_sheet.dart`), `app/lib/features/comments/` (data, `comments_view_model.dart`, `comments_section.dart`), `app/lib/features/points/` (data, `points_journal_view.dart`, `points_journal_view_model.dart`), тести поруч.
**Клієнт (змінити):** `photos/data/photos_models.dart`, `feed/ui/feed_card.dart`, `photos/ui/photo_viewer_view.dart`, `standings/data|ui` (прихильники), `profile/profile_card.dart`, `profile/profile_view.dart` (перемикач, журнал), `core/router.dart` (`/g/:id/points`), `core/realtime/live_loader.dart` (нові події), `core/services_scope.dart`, ARB uk/en + згенеровані.
**Документація:** `.agents/rules/project-overview.md`, `report/`.

---

### Task 1: Сервер — рушій балів `computePoints`

**Files:**
- Create: `server/src/points/points-engine.ts`, `points-engine.spec.ts`

**Interfaces:**
- Produces: `computePoints(input: PointsInput): PointEntry[]`, де `PointsInput { players: { id: string }[]; submissions: { memberId: string; dayIndex: number; submittedAt: Date; status: 'visible' | 'hidden' }[]; opensAt: ReadonlyMap<number, Date>; likes: { dayIndex: number; authorMemberId: string; likerMemberId: string }[] }` (players — активні гравці; решта відфільтровується всередині) і `PointEntry { memberId: string; dayIndex: number; kind: 'done' | 'speed' | 'late' | 'sympathy' | 'goal'; amount: number; detail?: number }` (`detail`: місце 1–3 для `speed`, діб запізнення для `late`, кількість лайків для `sympathy`). Допоміжне: `pointsPerDay`, `totalsOf(entries): Map<string, number>`.
- Consumes: нічого з інших задач.

- [ ] **Step 1: Тести** `points-engine.spec.ts` — по одному на рядок таблиці й на Review Focus 2–4: `done +10` за видиме виконання вчасно; `speed` +5/+3/+2 перших трьох за часом, четвертий без бонусу, рівний час — за id; `late`: рівно `opensAt+24h` — вчасно, +1 мс — `late −2`, три доби — `−6`, мінімум залишає 4 (десята доба — `late −6`, не −20); `sympathy`: 5 лайків у групі з 6 → +5; 2 з 5 гравців → `floor(5×2/4)=2`; група з 2 гравців — один лайк = +5; один гравець → 0 без ділення на нуль; лайк від себе, від неактивного й на приховане фото не рахуються; `goal`: 8 з 10 виконали → +3 кожному, хто виконав, 7 з 10 → нічого; приховане фото не дає ні `done`, ні `speed`, ні лічиться в цілі; вилучений/неактивний автор — нічого; заміна фото не змінює час (вхід вже містить перший `submittedAt`); сума по гравцю = `totalsOf`.
- [ ] **Step 2: Run:** `cd server && npx jest src/points` — Expected: FAIL (модуля немає).
- [ ] **Step 3: Implement** `computePoints` як чисту функцію без залежностей від Nest/репозиторіїв; константи таблиці — іменовані експорти (`basePoints=10`, `speedBonus=[5,3,2]`, `lateStep=2`, `lateFloor=4`, `sympathyMax=5`, `goalShare=0.8`, `goalBonus=3`, `dayMs`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(points): points engine for the design's table`.

---

### Task 2: Сервер — лайки

**Files:**
- Modify: `server/src/data/models.ts`, `repositories.ts`, `memory/memory-repositories.ts`, `firestore/firestore-repositories.ts`, `data.module.ts`, `repositories.contract.ts`, `photos/photos.service.ts`, `photos/views.ts`, `members/members.service.ts`, `app.module.ts`
- Create: `server/src/likes/likes.service.ts`, `likes.controller.ts`, `likes.module.ts`, `likes.service.spec.ts`; `server/test/likes.e2e-spec.ts`

**Interfaces:**
- Produces: `Like { groupId; dayIndex; authorMemberId; likerMemberId; createdAt: Date }`; `LikeRepository { add(like): Promise<boolean> /* false when already liked */; remove(groupId, dayIndex, authorMemberId, likerMemberId): Promise<boolean>; listByGroup(groupId): Promise<Like[]>; deleteForPhoto(groupId, dayIndex, authorMemberId): Promise<void>; deleteInvolving(groupId, memberId): Promise<void> }` (Firestore: плоска колекція `groups/{g}/likes`, id `${dd}_${author}_${liker}`); `PUT /groups/:id/days/:day/submissions/:memberId/like` → `204`, `DELETE` те саме → `204` (ідемпотентно); у `SubmissionView` нові поля `likes: { count: number; mine: boolean; by?: { memberId; displayName; avatar? }[] }` (`by` лише коли `likesCountOnly` вимкнено), подія `like.changed` `{ dayIndex, memberId }`; `FeedItem` успадковує.
- Consumes: `PhotosService.accessFor(kind, id, group, cell, submission, now)`, `viewerOf`, `PHOTO_EVENTS`.

- [ ] **Step 1: Контрактні тести** `LikeRepository` у `repositories.contract.ts`: `add` вдруге → `false`; `remove` неіснуючого → `false`; `listByGroup` лише своєї групи; `deleteForPhoto`; `deleteInvolving` (лайки від учасника й під його фото).
- [ ] **Step 2: Unit-тести** `likes.service.spec.ts` (Review Focus 1): лайк відкритого фото; власне — `403 own_photo`; розмите (глядач ще не виконав) — `403`; приховане, фото неактивного автора, чужа група, організатор що не грає (`403 not_playing`) — відмова; повторний лайк і зняття неіснуючого — `204` без змін; подія `like.changed` без імен.
- [ ] **Step 3: Run:** `cd server && npx jest src/data src/likes` — Expected: FAIL.
- [ ] **Step 4: Implement** репозиторії (пам'ять + Firestore), `LikesService.set(subject, groupId, day, authorId, liked: boolean)` через `accessFor` (`access.image === 'full'`, не власне, глядач — гравець), маршрути, поля `likes` у `PhotosService.list/feed/toView` (рахуються лише лайки активних гравців; `by` залежить від `group.settings.likesCountOnly`), чищення лайків при заміні фото (`submit` з `replaced`) і при вилученні учасника (`deleteMemberData`).
- [ ] **Step 5: e2e** `likes.e2e-spec.ts`: двоє учасників; А лайкає фото Б після власного виконання, `count` і `mine`; імена видно; `likesCountOnly` → `by` немає ні в Б, ні в стрічці; власне/розмите/приховане → відмова; заміна фото Б обнуляє лайки; вилучення А прибирає його лайк.
- [ ] **Step 6: Run:** `cd server && npx jest src/data src/likes && npx jest --config test/jest-e2e.json test/likes test/feed test/photos` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(likes): likes as votes on revealed photos`.

---

### Task 3: Сервер — коментарі

**Files:**
- Modify: `models.ts`, `repositories.ts`, `memory/*`, `firestore/*`, `data.module.ts`, `repositories.contract.ts`, `photos/photos.service.ts` (`commentCount`, чищення), `members/members.service.ts`, `app.module.ts`
- Create: `server/src/comments/comments.service.ts`, `comments.controller.ts`, `comments.module.ts`, specs; `server/test/comments.e2e-spec.ts`

**Interfaces:**
- Produces: `Comment { id; groupId; dayIndex; authorMemberId /* photo author */; memberId /* commenter */; text; createdAt }`; `CommentRepository { add(c): Promise<void>; get(groupId, id): Promise<Comment | undefined>; listForPhoto(groupId, dayIndex, authorMemberId): Promise<Comment[]> /* oldest first */; countsByGroup(groupId): Promise<Map<string, number>> /* ключ `${day}/${author}` */; delete(groupId, id): Promise<void>; deleteForPhoto(...); deleteInvolving(groupId, memberId) }`; `GET /groups/:id/days/:day/submissions/:memberId/comments` → `{ items: { id; memberId; displayName; avatar?; text; createdAt; mine: boolean; canDelete: boolean }[] }`; `POST …/comments` `{ text }` → `201` з елементом; `DELETE …/comments/:commentId` → `204`; події `comment.created|deleted` `{ dayIndex, memberId }`; у `SubmissionView` — `commentCount`.
- Consumes: `PhotosService.accessFor`, `viewerOf`, `MemberRepository`.

- [ ] **Step 1: Контрактні тести** `CommentRepository`: порядок «від найстаріших», лічильники по групі, видалення, `deleteForPhoto`, `deleteInvolving`.
- [ ] **Step 2: Unit-тести** (Review Focus 1, 5): текст обрізається за пробілами; порожній/лише пробіли → `400 invalid_text`; рівно 500 символів — ок, 501 → `400`; емодзі й кирилиця рахуються символами, а не байтами; коментувати/читати можна лише фото, видиме повністю (розмите — `403`), організатор, що не грає, не пише; видалення: автор — своє, організатор — будь-який, інший учасник — `403`; коментарі неактивного автора фото недоступні.
- [ ] **Step 3: Run:** `cd server && npx jest src/data src/comments` — Expected: FAIL.
- [ ] **Step 4: Implement** репозиторії, сервіс, контролер, `commentCount` у відповідях фото, чищення при заміні фото й вилученні учасника.
- [ ] **Step 5: e2e** `comments.e2e-spec.ts`: два учасники пишуть і читають; розмите — відмова; видалення чужого — `403`, організатор — `204`; подія `comment.created` приходить по WebSocket без тексту.
- [ ] **Step 6: Run:** `cd server && npx jest src/data src/comments && npx jest --config test/jest-e2e.json test/comments` — Expected: PASS.
- [ ] **Step 7: Commit** `feat(comments): comments under revealed photos`.

---

### Task 4: Сервер — бали, рейтинг і журнал за рушієм

**Files:**
- Create: `server/src/points/points.service.ts`, `points.controller.ts`, `points.module.ts`, `views.ts`, `points.service.spec.ts`; `server/test/points.e2e-spec.ts`
- Modify: `server/src/standings/standings.service.ts` (+ spec), `server/src/app.module.ts`

**Interfaces:**
- Consumes: `computePoints` (Task 1), `LikeRepository.listByGroup` (Task 2), `SubmissionRepository.listByGroup`, `CellRepository.list`, `openedDayCount`.
- Produces: `PointsService.entriesFor(groupId): Promise<{ players; entries: PointEntry[] }>` (спільне джерело для рейтингу й журналу); `GET /groups/:id/points` → `{ total: number; entries: { dayIndex; kind; amount; detail? }[] }` лише власні записи глядача-гравця (організатор, що не грає → `403 not_playing`); `GET /groups/:id/standings` — `points` з журналу, нове поле `fans: number` у кожному елементі.

- [ ] **Step 1: Unit-тести** `points.service.spec.ts` і оновлений `standings.service.spec.ts` (Review Focus 2): бали = сума журналу; заміна фото не множить; приховане/вилучені не дають; лайк змінює бали автора; `fans` = різні активні гравці, що лайкнули; журнал глядача — лише його записи; організатор що не грає — `403`.
- [ ] **Step 2: Run:** `cd server && npx jest src/points src/standings` — Expected: FAIL.
- [ ] **Step 3: Implement** `PointsService`, контролер, перехід `StandingsService` на журнал (місця «1,2,2,4» і `me.toNext` зберігаються).
- [ ] **Step 4: e2e** `points.e2e-spec.ts`: двоє виконують — швидкість +5/+3 у журналі першого/другого; лайк додає симпатії; зняття лайка знімає; рейтинг сходиться з сумою журналу; `403` для чужої групи, `401` без сесії.
- [ ] **Step 5: Run:** `cd server && npx jest src/points src/standings && npx jest --config test/jest-e2e.json test/points test/standings && ./scripts/check.sh` — Expected: PASS, усі `ok`.
- [ ] **Step 6: Commit** `feat(points): standings and journal from the points engine`.

---

### Task 5: Сервер — налаштування «лише кількість лайків»

**Files:**
- Modify: `server/src/groups/groups.controller.ts`, `groups.service.ts`, `groups.service.spec.ts`
- Create: `server/test/settings.e2e-spec.ts`

**Interfaces:**
- Produces: `PATCH /groups/:id/settings` `{ likesCountOnly?: boolean }` → `204` (лише власник; будь-яке інше поле або не-булеве значення → `400 invalid_settings`); `GroupsService.updateSettings(ownerUid, groupId, patch)`; подія не потрібна (клієнт читає групу при відкритті).
- Consumes: `GroupRepository.update`.

- [ ] **Step 1: Тести:** власник вмикає/вимикає; не власник → `403`; `{ likesCountOnly: 'yes' }` → `400`; невідоме поле → `400`; порожнє тіло → `400`; після вмикання відповідь фото (e2e) не містить `by`.
- [ ] **Step 2: Run:** `cd server && npx jest src/groups && npx jest --config test/jest-e2e.json test/settings` — Expected: FAIL.
- [ ] **Step 3: Implement** метод і маршрут.
- [ ] **Step 4: Run** ті самі команди — Expected: PASS.
- [ ] **Step 5: Commit** `feat(groups): organizer switch for likes-count-only`.

---

### Task 6: Клієнт — моделі, репозиторії, події

**Files:**
- Create: `app/lib/features/likes/data/likes_repository.dart`, `app/lib/features/comments/data/comments_models.dart`, `comments_repository.dart`, `app/lib/features/points/data/points_models.dart`, `points_repository.dart`; тести моделей
- Modify: `app/lib/features/photos/data/photos_models.dart` (`LikeInfo`, `commentCount`), `app/lib/features/standings/data/standings_models.dart` (`fans`), `app/lib/features/groups/data/groups_repository.dart` (`setLikesCountOnly`), `app/lib/core/realtime/live_loader.dart` (набори подій), `app/lib/core/services_scope.dart`, фейки репозиторіїв у наявних тестах

**Interfaces:**
- Consumes: сервер Tasks 2–5.
- Produces: `LikeInfo { count: int; mine: bool; by: List<Liker>? }`, `SubmissionItem.likes`, `SubmissionItem.commentCount`; `LikesRepository.setLiked(groupId, dayIndex, authorId, bool liked)`; `CommentItem { id, memberId, displayName, avatar?, text, createdAt, mine, canDelete }`, `CommentsRepository { list, add(text), delete }`; `PointEntry { dayIndex, kind: PointKind, amount, detail? }`, `PointsJournal { total, entries }`, `PointsRepository.journal(groupId)`; `StandingItem.fans`; `GroupsRepository.setLikesCountOnly(groupId, bool)`; набір `likeEvents = {'like.changed'}` і `commentEvents = {'comment.created','comment.deleted'}`, додані до `submissionEvents`-сімейства так, щоб стрічка, день, рейтинг і прогрес перечитувались на них.

- [ ] **Step 1: Тести моделей** (розбір `likes` з `by` і без, `commentCount`, `fans`, `PointEntry`, невідомий `kind` не падає; порожній журнал); тест `LiveLoader`-наборів: нова подія перечитує рейтинг і стрічку.
- [ ] **Step 2: Run:** `cd app && flutter test test/features/likes test/features/comments test/features/points test/core` — Expected: FAIL.
- [ ] **Step 3: Implement** моделі, репозиторії (+ реєстрація в `AppServices`), оновлення фейків.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): data layer for likes, comments and points`.

---

### Task 7: Клієнт — лайки в стрічці й перегляді

**Files:**
- Create: `app/lib/features/likes/ui/like_button.dart`, `likers_sheet.dart`, `like_view_model.dart`; тести
- Modify: `app/lib/features/feed/ui/feed_card.dart`, `app/lib/features/photos/ui/photo_viewer_view.dart` (`PhotoViewerBody`), ARB

**Interfaces:**
- Consumes: `SubmissionItem.likes`, `LikesRepository.setLiked`.
- Produces: `LikeButton({ required LikeInfo likes, required bool enabled, required Future<void> Function(bool liked) onToggle, VoidCallback? onShowLikers })` — сердечко з лічильником; `enabled == false` для власного, розмитого фото й для глядача, що не грає (кнопка видима, але неактивна лише там, де лайк недоступний; на розмитому — взагалі не показується); `LikeViewModel` — оптимістичне перемикання з відкатом і ігноруванням повторного натискання; `LikersSheet` — імена (коли `by` є), порожньо коли `by == null`.

- [ ] **Step 1: Тести:** `LikeViewModel`: перемикає, відкочує при помилці, ігнорує другий тап, не діє при `enabled == false`; віджет-тести `LikeButton`: лічильник, стан «лайкнуто», неактивна кнопка, `onShowLikers` лише коли є `by`; картка стрічки: на розмитому фото немає кнопки лайка.
- [ ] **Step 2: Run:** `cd app && flutter test test/features/likes test/features/feed` — Expected: FAIL.
- [ ] **Step 3: Implement** кнопку, view-model і шторку; вставити в `FeedCard` і `PhotoViewerBody` (не показувати для власного фото — там лише кількість); ARB-рядки.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): likes on feed cards and in the viewer`.

---

### Task 8: Клієнт — коментарі

**Files:**
- Create: `app/lib/features/comments/ui/comments_view_model.dart`, `comments_section.dart`; тести
- Modify: `app/lib/features/photos/ui/photo_viewer_view.dart` (розділ коментарів під фото), `app/lib/features/feed/ui/feed_card.dart` (кількість коментарів), ARB

**Interfaces:**
- Consumes: `CommentsRepository`, `SubmissionItem.commentCount`, події `comment.*`.
- Produces: `CommentsViewModel(repository, realtime, groupId, dayIndex, authorMemberId)` — `items`, `send(text)` (порожнє/лише пробіли не надсилає; ≤ 500), `delete(id)`, перечитування на `comment.*` і resync, `failed`/`sending`; `CommentsSection` — список «ім'я · текст», поле вводу, «Видалити» лише там, де `canDelete`.

- [ ] **Step 1: Тести:** `send` обрізає й не шле порожнє; 501 символ → помилка поля без запиту; після `send` список оновлюється; видалення лише за `canDelete`; подія `comment.created` перечитує; помилка мережі лишає список; віджет-тест `CommentsSection` (порожній стан, список, кнопка видалення за `canDelete`).
- [ ] **Step 2: Run:** `cd app && flutter test test/features/comments` — Expected: FAIL.
- [ ] **Step 3: Implement** view-model і секцію, вбудувати у перегляд (лише для видимих повністю фото), лічильник у картку; ARB.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): comments under photos`.

---

### Task 9: Клієнт — журнал балів, прихильники, перемикач

**Files:**
- Create: `app/lib/features/points/ui/points_journal_view.dart`, `points_journal_view_model.dart`; тести
- Modify: `app/lib/features/profile/profile_card.dart`, `profile_summary.dart`, `profile_view.dart` (перемикач «лише кількість лайків» для власника, посилання на журнал), `app/lib/features/standings/ui/standings_list.dart` (прихильники), `app/lib/core/router.dart` (`/g/:groupId/points`), ARB

**Interfaces:**
- Consumes: `PointsRepository.journal`, `StandingItem.fans`, `GroupsRepository.setLikesCountOnly`, `GroupHomeViewModel`/група для поточного значення налаштування.
- Produces: `PointsJournalViewModel` (`LiveLoader` над `journal`, перечитується на події рейтингу) і `PointsJournalView` (групування за днем, підписи видів: «Виконано», «Швидкість · 1-й», «Пізно · −2», «Симпатії · N лайків», «Спільна ціль», разом); `ProfileSummary.fans`; у рядку рейтингу — «❤ N»; перемикач у «Група».

- [ ] **Step 1: Тести:** підписи видів і групування за днем (чиста функція `groupJournal(entries)`); порожній журнал; `ProfileSummary` з `fans`; рядок рейтингу показує прихильників, нуль — не показує; перемикач у профілі власника викликає `setLikesCountOnly` і відкочується при помилці.
- [ ] **Step 2: Run:** `cd app && flutter test test/features/points test/features/profile test/features/standings` — Expected: FAIL.
- [ ] **Step 3: Implement** екран, маршрут, зміни профілю й рейтингу; ARB.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): points journal, fans and the likes-count-only switch`.

---

### Task 10: Наскрізна перевірка, документація, звіт

**Files:**
- Modify: `tool/e2e_web.mjs`, `.agents/rules/project-overview.md`, `report/report_<дата_час>.md`

- [ ] **Step 1: Розширити `tool/e2e_web.mjs`:** Webby лайкає фото Bella (після власного виконання), коментар з'являється в перегляді, у «Рейтингу» бали Bella зросли (швидкість/симпатії), журнал «Я» показує записи; перемикач «лише кількість лайків» ховає імена (перевірка через API).
- [ ] **Step 2: Run:** `cd server && ./scripts/check.sh`, `cd app && ./tool/check.sh`, e2e-скрипт на свіжих збірках — Expected: усе `ok`.
- [ ] **Step 3: Контракти на емуляторі** (Docker, як у P3/P4) для нових репозиторіїв — Expected: усі проходять.
- [ ] **Step 4: Документація:** `project-overview.md` (версія, нові маршрути й події, таблиця балів зі статусом рядків), звіт з повним текстом завдання, запитом синхронізації клієнта й рішеннями 1–12.
- [ ] **Step 5: Commit** `docs(p5): overview, report and full-flow browser check`.

---

## Самоперевірка плану

- **Покриття:** лайки/голоси (Task 2, 7), коментарі (3, 8), журнал і таблиця (1, 4, 9), швидкість/пізнє/симпатії/ціль (1), «лише кількість лайків» (2, 5, 9), рейтинг наживо (4, 6, 9). Поза P5 за roadmap: джокери, «раптова клітинка», фінальні призи, «штурхнути», перегляди, скарги на коментарі.
- **Типи:** `PointEntry`/`computePoints` (Task 1) — єдині в Task 4 і 6/9; `likes`/`commentCount` у `SubmissionView` (2, 3) ↔ `LikeInfo`/`commentCount` (6).
- **Пропорція:** рушій балів — чиста функція з тестом на кожен рядок; решта — тонкі шари над наявним `PhotosService`.
