# CommandVibe — Project Overview

**Дата оновлення:** 2026-11-27
**Версія документа:** 2.11 (каталог завдань погоджено власником: 164 завдання)

> **Статус:** хвиля 1, частина P1 реалізована (у `main`) і **перевірена власником на проді 27.11** (вхід Google, створення групи, приєднання з іменем і PIN, живий список). P2 (календар і рулетка) розгорнуто на API (ревізія `00004`). P3 (фото) реалізовано в гілці `worktree-p3-photos`; на прод ще не розгорнуто. API розгорнуто 27.11: Cloud Run `commandvibe-api` (ревізія `00002`, `https://commandvibe-api-889388170734.europe-central2.run.app`); веб — на живому сайті `commandvibe.karavanstudio.dev` (27.11). Дизайн: `docs/specs/2026-11-19-photo-challenge-design.md` (розділ 2а має пріоритет). План: `docs/superpowers/plans/2026-11-26-wave1-roadmap.md`, `…-wave1-p1-foundation.md`.

## Загальна інформація

- Групова фото-челендж гра: організатор запускає гру на 7–31 день, щодня відкривається завдання, учасники виконують його фото. Чужі фото розмиті, доки учасник не виконав завдання сам або не минуло 2 дні (о 9:00 за часом групи).
- Бали, лайки як голоси, рейтинг наживо, рулетка, фінал (топ-3, номінації, колаж), HR-звіти. Тайний Санта — поза першим сезоном.
- Назва CommandVibe. Веб: `commandvibe.karavanstudio.dev` (Firebase Hosting, сайт `commandvibe-ks`). Firebase-проєкт `commandvibe-ks`, усе в `europe-central2`.
- Платформи з першого дня: Web (PWA), Android, iOS (стори — окреме рішення власника).
- Старт перших груп — коли готова вся хвиля 1 (орієнтир 10–12 грудня).
- Мови: UA і EN. Анти-цілі: стеження за людьми, витік фото, ручна щоденна робота організатора.

## Модулі

- **`server/`** — NestJS + TypeScript (Cloud Run `commandvibe-api`):
  - `data/` — моделі й репозиторії за інтерфейсами (`memory/` для тестів і локально, `firestore/` для роботи), контрактні тести спільні.
  - `auth/` — власні сесії (`SessionService`), `AuthGuard` (глобальний; `@Public()` — виняток), `/auth/refresh|logout|me`.
  - `organizers/` — вхід організатора: Firebase ID token → сесія сервісу.
  - `groups/` — створення групи, посилання-запрошення (ротація, закриття), доступ власника/учасника.
  - `members/` — приєднання за посиланням, підтвердження нових, PIN, дії організатора, сторінка запрошення `/j/:token`.
  - `game/` — гра: `game-time.ts` (час у поясі групи з урахуванням DST), `task-picker.ts` (авто-підбір без повторів з урахуванням категорій і сезону, «Інше»), `roulette.ts` (кому крутити — хто крутив найменше; колесо з номерів днів), `calendar.service.ts` (налаштування гри, конструктор календаря), `game-engine.ts` (`advance` — ідемпотентне відкриття днів і рулетка; `spin`; `today`), `tick.controller.ts` + `tick.guard.ts` (`POST /internal/tick` для Cloud Scheduler з власною перевіркою OIDC), `game-events.ts` (події в тему `group:<id>`).
  - `photos/` — фото дня: `image-type.ts` (тип за магічними байтами), `image-pipeline.ts` (sharp: поворот за EXIF, 1600 px, JPEG без метаданих, розмите прев'ю з 32 px), `exif-time.ts` (час зйомки), `photo-access.ts` (`decidePhotoAccess` — єдине джерело правди про доступ), `photo-url.ts` (підписані посилання `/p/<token>`, ключ з HKDF від `SESSION_SIGNING_KEY`), `photo-store.ts` + `gcs-photo-store.ts` (пам'ять і GCS), `upload-gate.ts` (ліміти одночасних завантажень і обробок), `read-body.ts` (читання тіла з ліміту 20 МіБ), `photos.service.ts`, `moderation.service.ts` (скарги, приховування), контролери.
  - `progress/` — `GET /groups/:id/progress`: по днях скільки виконали й чи виконав глядач, `currentDay`. `feed/` — `GET /groups/:id/feed`: стрічка фото всіх днів новіші згори, курсор, фільтри, доступ — той самий `decidePhotoAccess` через `PhotosService.feed`. `standings/` — `GET /groups/:id/standings`: бали (у P4 лише 10 за кожне видиме фото), спільні місця, «моє місце» з відставанням. Вибір аватара — `PUT /groups/:id/me/avatar` (`members/avatars.ts`, 24 id).
  - `realtime/` — підключення ks_server realtime: доступ до тем `group:<id>` і `org:<id>`, події учасників.
  - `content/` — каталог завдань дня v2 (164 завдання UA + EN, погоджено власником 28.11; дані — `task-catalog.data.ts`, модель — `task-catalog.model.ts`). Категорії: `home` вдома, `street` вулиця, `office`, `cheap` дешево, `kids` з дітьми, `winter`, `summer`, `team` командне, `pair` парне — 1–4 на завдання, ≥30 у кожній (тест). Аудиторії v1 (офіс/студенти/друзі/сім’я) лишилися полем «для кого»; теми v1 «креатив» і «вихідні» прибрано. `isOfferedInMonth`: літо — травень–вересень, зима — листопад–березень. Таблиця для правки власником — `docs/content/task-catalog-v2.md` (генерує `src/content/render-catalog.ts`; тест звіряє її з даними; v1 — історична). У Firestore — лише після «каталог погоджено».
  - `shared/realtime`, `shared/app_check` — копії бібліотек (sync із чистих клонів тегів ks_server v0.3.0, ks_core v0.6.2), не редагуються.
  - `testing/` — `/test/seed-group`, лише з `NODE_ENV=test` і пам'яттю.
- **`app/`** — Flutter (Web/Android/iOS), feature-first, MVVM на ChangeNotifier, go_router:
  - `core/platform/` — абстракції з реалізаціями для вебу й застосунків: `SessionStore` (localStorage / secure storage), `InviteLinkSource` (`/join?t=` / App Links і Universal Links `/j/`: пакет і bundle ID `com.karavanstudio.commandvibe`, `app/web/.well-known/assetlinks.json` і `apple-app-site-association` з Team ID `8RTTR2Y32B`; тест `app_links_config_test.dart` звіряє їх із нативними проєктами), `PhotoSource` (image_picker без зменшення — EXIF зберігається), `OrganizerSignIn` (popup→redirect / signInWithProvider).
  - `core/api/` — `ApiClient` (токен, `x-realtime-session`, один спільний refresh на `401`).
  - `core/theme/` — «Скло»: `GlassTokens` (макети E/E2), `GlassPanel` з запасним варіантом без розмиття.
  - `features/` — `welcome`, `organizer_auth`, `groups` (створення, поширення запрошення, головна групи з живим списком), `calendar` (налаштування гри, редактор календаря: «Інше», з каталогу, своє завдання, переставити дні), `photos` (дані й надсилання, «Виконати», смуга фото дня, розмиті плитки, перегляд на весь екран, скарги й приховування), `today` (картка «Сьогодні»: завдання дня або рулетка з синхронною анімацією), `join` (приєднання, очікування підтвердження, PIN, повернення; організатор, що відкрив своє посилання, не перезаписує сесію).
  - Вкладки групи (`features/shell`, `core/ui/adaptive_shell.dart`): нижня панель до 840 px, бічна від; маршрути `/g/:id/today|days|feed|rating|me`, п'ята — «Я» (учасник) або «Група» (організатор: інструменти, запрошення, скарги). `AccessWatcher` у оболонці виводить з групи, коли доступ відкликано. `core/realtime/live_loader.dart` — значення з API, що оновлюється подіями групи.
  - `features/progress`, `standings`, `feed`, `avatars`, `profile` — клієнтські частини P4; `features/calendar/ui/days_view.dart` — сітка дверцят і шторка дня.
  - `l10n/` — UA (основна) і EN.
- **`tool/`** — `deploy_api.sh` (ревізія `candidate`), `deploy_web_preview.sh`, `e2e_web.mjs` (сценарій у headless Chrome). Порядок деплою — `docs/deploy.md`.
- **Спільні бібліотеки (змінювати звідси заборонено):** ks_core (клієнт; веб-прогалини — задача ks_core/2026-11-26-web-support), ks_server (сервер).

## Архітектура

- Клієнт працює лише з сервісом: REST + WebSocket. Firebase на клієнті — лише Auth (і App Check); Firestore/Storage — правила «заборонено все».
- Сесії: токен доступу HS256 (15 хв, ключ `SESSION_SIGNING_KEY` із Secret Manager) + токен оновлення `<sessionId>.<секрет>` (у базі SHA-256, ротація при кожному оновленні; повтор старого → відкликання всієї сесії). Відкликання діє одразу (перевірка сесії на кожному запиті).
- PIN: спроба резервується атомарно до перевірки argon2 (`reservePinAttempt`), тож паралельні запити не обходять блок 5 спроб / 15 хв.
- Ротація refresh — атомарне «порівняти й замінити» (`rotateRefresh`); програш гонки = повторне використання → відкликання.
- `401` від `AuthGuard` має `code: token_invalid`; клієнт оновлює сесію лише на нього, а перед оновленням перечитує сховище (токени могла вже оновити інша вкладка чи запит).
- Клієнт: `ObservedSessionStore` — сигнал для go_router; втрата сесії одразу виводить із захищених сторінок.
- Id групи й учасника в URL — лише `^[a-f0-9]{20}$` (`400 invalid_id`); id документа-індексу імені — SHA-256 від ключа імені.
- Guard-и: `AuthGuard` → `AppCheckGuard` (режим `APP_CHECK_MODE`, за замовчуванням `monitor`).
- Realtime: `verifyToken` = перевірка сесії; `group:<id>` — активні учасники й власник; `org:<id>` — лише власник. Вилучення учасника: статус `removed` → відкликання сесій → `disconnectUser` (закриття `4403`). `member:<id>` — особиста тема учасника (навіть у статусі `pending`): `member.approved` після підтвердження.
- Один екземпляр сервісу (`min/max-instances=1`), `--timeout=3600 --concurrency=1000`.
- Firestore: база з назвою `commandvibe` (europe-central2), не `(default)`; сервер бере назву з `FIRESTORE_DATABASE` (за замовчуванням `(default)`, як в емуляторі).
- Вхід Google у вебі йде через домен сторінки (`authDomain` = домен Hosting): блокування сторонніх cookie ламало redirect (перевірка першого дня).
- Фото: клієнт надсилає оригінал (≤ 15 МіБ, HEIC відхиляється з поясненням); сервер приймає ≤ 20 МіБ, визначає тип за магічними байтами, повертає за EXIF, зменшує до 1600 px, видаляє всі метадані, робить розмите прев'ю (з 32 px, тож відновити фото неможливо). Сирий оригінал не зберігається ніде. Файли — у бакеті `commandvibe-ks-photos` (`groups/{g}/cells/{dd}/{member}/{version}/photo.jpg|blur.jpg`); клієнти бачать лише короткі підписані посилання `/p/<token>` самого API (5–10 хв), і доступ перевіряється наново при кожній віддачі файлу.
- Доступ до фото: чужі фото розмиті, доки учасник не виконав завдання сам або не настало розкриття (`revealAt` = 9:00 другого дня після запланованого дня, за поясом групи); організатор, що не грає, бачить розмите до розкриття, а повне — лише фото з відкритою скаргою; приховування саме по собі не знімає розмиття. Позначку «знято раніше» і підказку камера/галерея бачить лише організатор.
- Розкриття — крок `GameEngine.advance` (подія `photos.revealed`, один раз завдяки `markRevealed`); гра завершується, коли розкрито фото останнього дня (раніше — через 24 год після відкриття).
- Навантаження: до 8 тіл одночасно, до 2 обробок sharp із чергою 6, понад ліміт — `503 busy` + `Retry-After: 3`; Cloud Run `--memory=1Gi --cpu=1`.
- Гра: день відкривається о `openTime` у поясі групи (DST враховано). `GameEngine.advance` викликають і `/internal/tick` (щохвилини), і читання `calendar`/`today`, тож гра йде й без Scheduler. Рулетка: гра обирає учасника, що крутив найменше; на це 3 год від початку вибору, далі крутить гра; колесо — номери закритих днів (не назви), завдання за обраними дверцятами міняється місцями з сьогоднішнім; пропущені дні відкриває гра. Анімація однакова в усіх: клієнти рахують її від часу сервера.
- Деплой бекенду: ревізія `candidate` без трафіку → перевірки → трафік (з дозволу).

## API

Усі маршрути, крім `@Public()`, вимагають `Authorization: Bearer <access>`; помилки — JSON із `code`.

| Метод | Шлях | Хто | Що |
|---|---|---|---|
| GET | `/health` | публічно | `{ok:true}` |
| POST | `/auth/organizer` | публічно | `{idToken}` (Firebase, Google/email) → `{accessToken, refreshToken, expiresAt, organizer}`; інший провайдер → `403` |
| POST | `/auth/refresh` | публічно | `{refreshToken}` → нова пара; повтор старого → `401` і відкликання |
| POST | `/auth/logout` | сесія | `204` |
| GET | `/auth/me` | сесія | суб'єкт сесії |
| POST | `/groups` | організатор | `{name, timezone, playsToo=true, approveNew=false}` → `{group, inviteUrl}` |
| GET | `/groups` | організатор | `{items:[{id,name,status,activeMembers,createdAt}]}` — лише власні, нові спершу |
| GET | `/groups/:id/progress` | власник / учасник | `{days:[{dayIndex, done, total, mine}], currentDay?, serverTime}`; приховані фото й неактивні не рахуються; `mine: null` — організатор не грає |
| GET | `/groups/:id/feed?day&memberId&mine&limit&before` | власник / учасник | `{items:[фото дня + dayIndex, taskTitle, revealAt, avatar], next?}`; розмите без `photoUrl`; приховані й вилучених немає; погане `before` → `400 invalid_cursor` |
| GET | `/groups/:id/standings` | власник / учасник | `{items:[{memberId, displayName, avatar?, points, rank, mine}], me?:{rank, points, toNext?}}` |
| PUT | `/groups/:id/me/avatar` | учасник / організатор-гравець | `{avatar: 'av01'..'av24' \| null}` → `204`; невідомий id → `400 invalid_avatar`; організатор не грає → `403 not_playing` |
| GET | `/groups/:id` | власник / активний учасник | група (без хешу запрошення) |
| POST | `/groups/:id/invite/rotate` · `/invite/close` | власник | нове посилання · закрити |
| GET | `/groups/:id/members` | власник (з `pending`) / учасник | список |
| POST | `/groups/:id/members/:mid/approve` · `/remove` · `/reset-pin` | власник | `204` |
| PATCH | `/groups/:id/members/:mid/name` | власник | `409 name_taken` |
| GET | `/join/:token` | публічно | `{groupName, memberCount, approveNew}`; закрите → `410` |
| POST | `/join` | публічно | `{token, displayName, department?}` → сесія учасника; `409 name_taken`, `410 invite_closed`, `422 group_full / invalid_name / invalid_department` |
| POST | `/join/returning` | публічно | `{token, displayName, pin}` → сесія; `401 wrong_pin {attemptsLeft}`, `429 pin_locked {retryAfterSeconds}`, `401 no_such_login` |
| GET | `/me` · PUT `/me/pin` | учасник | профіль · PIN рівно 4 цифри |
| GET | `/j/:token` | публічно | HTML з OG-тегами → `/join?t=`; закрите → `410` |
| GET | `/catalog?category=&q=` | організатор | завдання каталогу для вибору |
| PUT | `/groups/:id/game` | власник | `{startDate, days 7–31, openTime?, mode auto\|roulette, categories}` → календар; `422 invalid_date/start_in_past/invalid_days/invalid_time/invalid_mode/invalid_categories`, `409 game_started` |
| GET | `/groups/:id/calendar` | власник / учасник | `{game, days[], serverTime}`; учасник бачить `task` лише відкритих днів |
| POST | `/groups/:id/calendar/days/:day/other` | власник | інше завдання з тих самих категорій; `409 day_opened/no_more_tasks` |
| PUT | `/groups/:id/calendar/days/:day/task` | власник | `{taskId}` або `{custom:{title,description}}`; `422 unknown_task/invalid_custom`, `409 task_in_game/day_opened` |
| POST | `/groups/:id/calendar/days/:day/move` | власник | `{to}` — обмін завдань двох днів |
| GET | `/groups/:id/today` | власник / учасник | `{status, game?, day?, serverTime}`; у відкритого дня — `revealAt`; у `day` — `pickerMemberId`, `pickDeadlineAt`, `isMyTurn`, `spin`; завдання рулетки з'являється після кінця анімації |
| POST | `/groups/:id/roulette/spin` | вибраний учасник | `204`; `403 not_your_turn`, `409 not_picking/deadline_passed` |
| POST | `/internal/tick` | Cloud Scheduler (OIDC) | відкриває дні й крутить рулетку в усіх групах з грою (збій однієї групи не зупиняє решту; відповідь `{advanced, failed}`); `404`, доки не задано `TICK_AUDIENCE` і `TICK_INVOKER` |
| POST | `/groups/:id/days/:day/submission?source=camera\|gallery` | учасник (і організатор, що грає) | тіло — сирі байти `image/*`; `201 SubmissionView`; `413 photo_too_large`, `415 heic_unsupported/unsupported_type`, `422 invalid_image`, `403 not_playing`, `409 day_not_open/game_finished/already_submitted {version}`, `503 busy` |
| PUT | `/groups/:id/days/:day/submission?replaces=<version>` | автор | заміна до розкриття; `409 version_mismatch/reveal_passed/photo_hidden` |
| GET | `/groups/:id/days/:day/submissions` | власник / учасник | `{revealAt, revealed, canSubmit, mine?, items[], total, serverTime}`; у елемента `access` full\|blur, `photoUrl` лише при full, `moderation` лише власнику |
| GET | `/p/:token` | підписане посилання | JPEG або голий `404` (протерміновано, підроблено, доступ скасовано) |
| POST | `/groups/:id/days/:day/submissions/:mid/complaints` | учасник | `{reason?}` → `204`; `403 not_visible/not_playing`, `422 own_photo/invalid_reason`, `404 no_submission` |
| GET | `/groups/:id/complaints` | власник | відкриті скарги зі скаржниками |
| PUT | `/groups/:id/days/:day/submissions/:mid/hidden` | власник | `{hidden}` → `204`; приховування закриває скарги |
| POST | `/groups/:id/days/:day/submissions/:mid/complaints/dismiss` | власник | `204` |
| WS | `/ws` | сесія | протокол ks_server v1; теми `group:`, `org:`, `member:`; події фото `submission.created|replaced|hidden|restored`, `photos.revealed` (у `group:`) і `complaint.created` (у `org:`), без посилань і вмісту; події гри `day.opened`, `roulette.waiting`, `roulette.spin`, `game.finished` (у `group:`; без вмісту завдань); події `member.joined`, `member.removed`, `member.pending` (`org:`), `member.approved` (`member:`) |
| POST | `/test/seed-group` | лише `NODE_ENV=test` | тестова група; `{game:{mode}}` — гра, що почалась сьогодні |

## Моделі даних

Firestore (за репозиторіями): `organizers/{uid}` {email, displayName?}; `sessions/{id}` {subject{kind,id,groupId?}, refreshTokenHash, deviceInfo, createdAt, revokedAt?}; `groups/{id}` {ownerUid, name, timezone, status, settings{approveNew, memberLimit=50, likesCountOnly, departments[]}, inviteTokenHash, inviteClosed}; `groups/{id}/members/{mid}` {displayName, nameKey, status pending|active|removed, isOrganizer, organizerUid?, department?}; `…/members/{mid}/private/secrets` {pinHash?, pinFailures, lockedUntil?}; `groups/{id}/nameIndex/{nameKey}` {memberId} — унікальність імені в транзакції.
`groups/{id}.game` {startDate, days, openTime, mode auto|roulette, categories[]}; `groups/{id}/cells/{dayIndex 2 цифри}` {task (catalog taskId або custom title/description), opensAt, state closed|picking|open, openedAt?, pickerMemberId?, pickDeadlineAt?, spin? {startAt, durationMs, doors[], winnerIndex, by}} — усі переходи через `transition` (порівняти й замінити); відкриття рулеткою — `openBySpin` (одна транзакція: день відкривається, завдання з обраних дверцят і сьогоднішнє міняються місцями); статус групи міняє `setStatus` (теж порівняти й замінити).
`groups/{g}/cells/{dd}.revealedAt` — лише прибирає дубль події. `groups/{g}/cells/{dd}/submissions/{memberId}` {version, photoPath, blurPath, width, height, submittedAt (перше надсилання), updatedAt, takenAt?, source camera|gallery|unknown, flags{takenBefore}, status visible|hidden, hiddenAt?}; `groups/{g}/complaints/{dd_author_complainer}` {dayIndex, authorMemberId, complainerMemberId, reason, status open|resolved, createdAt, resolvedAt?}. Нових складених індексів немає.
Наступні частини (P4–P7): `likes`, `comments`, `points`, `standings` — за розділом 12 дизайну.

## Історія версій

- 2.11 (2026-11-28) — каталог завдань: власник погодив 28.11, прибрано 7 завдань (Рукавиці, Руки команди, Чашки команди, Командна гра, Ланцюжок шарфів, Дзеркальна поза, Літера на двох), тексти 14 завдань і «для кого» 4 завдань — дослівно зі знімка власника; мінімум на категорію в тесті 29 (у «командне» 29).
- 2.10 (2026-11-28) — P4: п'ять вкладок із реальними даними (Сьогодні: хід дня, моє місце, події з realtime; Календар: сітка дверцят і шторка дня; Стрічка: фільтри, пагінація, гортання на весь екран; Рейтинг: живі місця зі стрілками; Я/Група: аватар, бали, PIN, інструменти організатора), колекція з 24 аватарів, сервер: progress, feed, standings, avatar; підпис iOS командою 8RTTR2Y32B.
- 2.9 (2026-11-27) — залежність `ks_core` v0.7.0: вхід Google організатора через `AuthService`/`FirebaseAuthService` (`KsOrganizerSignIn`), на Android/iOS — рідний вибір акаунта Google (`google_sign_in` 7; web client ID і iOS client ID — у `ks_organizer_sign_in.dart`, URL-схема в `Info.plist`), на вебі — popup із переходом на redirect; прямий `firebase_auth` прибрано. Токен Firebase лише обмінюється на сесію API, тому `AuthHttpClient` не потрібен. Контракт-тест імен: `ALREADY_EXISTS` → `NameTakenError`.
- 2.8 (2026-11-27) — «Мої групи»: `GET /groups`; після входу організатор потрапляє на `/org/groups` (немає груп → створення, одна → одразу в неї, кілька → список; з групи — іконка «Мої групи» → `/org/groups?all=1`); екран `/g/:id/invite` видає нове посилання через `invite/rotate` (старе перестає діяти; посилання не відновлюється, бо зберігається лише хеш).
- 2.7 (2026-11-27) — P3: фото (обробка sharp, EXIF, розмиття), доступ `decidePhotoAccess`, підписані посилання `/p/`, розкриття о 9:00, скарги й приховування, видалення даних при вилученні учасника; гра завершується після розкриття останнього дня.
- 2.6 (2026-11-27) — P2: календар, «авто щодня» і рулетка, двигун гри, `/internal/tick`, картка «Сьогодні».
- 2.5 (2026-11-27) — P1 перевірено власником на проді.
- 2.4 (2026-11-27) — веб на живому сайті; пакет `com.*`; App Links і Universal Links.
- 2.3 (2026-11-27) — перший деплой API; `FIRESTORE_DATABASE`.
- 2.2 (2026-11-26) — каталог завдань v2 (див. `content/`).
- 2.1 (2026-11-26) — виправлення за фінальним рев'ю P1 (див. вище); App Links / Universal Links підключено у 2.4.
- 2.0 (2026-11-26) — P1: сервер (сесії, вхід організатора, групи, приєднання, PIN, realtime, App Check, сторінка запрошення), застосунок Web/Android/iOS (вхід, створення групи, приєднання, PIN, живий список), каталог 76 завдань, скрипти деплою.
- 1.0 (2026-11-26) — перший огляд за дизайном; коду не було.
