# CommandVibe — Project Overview

**Дата оновлення:** 2026-11-27
**Версія документа:** 2.5 (P1 перевірено власником на проді)

> **Статус:** хвиля 1, частина P1 реалізована (у `main`) і **перевірена власником на проді 27.11** (вхід Google, створення групи, приєднання з іменем і PIN, живий список). Далі — P2. API розгорнуто 27.11: Cloud Run `commandvibe-api` (ревізія `00002`, `https://commandvibe-api-889388170734.europe-central2.run.app`); веб — на живому сайті `commandvibe.karavanstudio.dev` (27.11). Дизайн: `docs/specs/2026-11-19-photo-challenge-design.md` (розділ 2а має пріоритет). План: `docs/superpowers/plans/2026-11-26-wave1-roadmap.md`, `…-wave1-p1-foundation.md`.

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
  - `realtime/` — підключення ks_server realtime: доступ до тем `group:<id>` і `org:<id>`, події учасників.
  - `content/` — каталог завдань дня v2 (171 завдання UA + EN; дані — `task-catalog.data.ts`, модель — `task-catalog.model.ts`). Категорії: `home` вдома, `street` вулиця, `office`, `cheap` дешево, `kids` з дітьми, `winter`, `summer`, `team` командне, `pair` парне — 1–4 на завдання, ≥30 у кожній (тест). Аудиторії v1 (офіс/студенти/друзі/сім’я) лишилися полем «для кого»; теми v1 «креатив» і «вихідні» прибрано. `isOfferedInMonth`: літо — травень–вересень, зима — листопад–березень. Таблиця для правки власником — `docs/content/task-catalog-v2.md` (генерує `src/content/render-catalog.ts`; тест звіряє її з даними; v1 — історична). У Firestore — лише після «каталог погоджено».
  - `shared/realtime`, `shared/app_check` — копії бібліотек (sync із чистих клонів тегів ks_server v0.3.0, ks_core v0.6.2), не редагуються.
  - `testing/` — `/test/seed-group`, лише з `NODE_ENV=test` і пам'яттю.
- **`app/`** — Flutter (Web/Android/iOS), feature-first, MVVM на ChangeNotifier, go_router:
  - `core/platform/` — абстракції з реалізаціями для вебу й застосунків: `SessionStore` (localStorage / secure storage), `InviteLinkSource` (`/join?t=` / App Links і Universal Links `/j/`: пакет і bundle ID `com.karavanstudio.commandvibe`, `app/web/.well-known/assetlinks.json` і `apple-app-site-association` з Team ID `8RTTR2Y32B`; тест `app_links_config_test.dart` звіряє їх із нативними проєктами), `PhotoSource` (image_picker без зменшення — EXIF зберігається), `OrganizerSignIn` (popup→redirect / signInWithProvider).
  - `core/api/` — `ApiClient` (токен, `x-realtime-session`, один спільний refresh на `401`).
  - `core/theme/` — «Скло»: `GlassTokens` (макети E/E2), `GlassPanel` з запасним варіантом без розмиття.
  - `features/` — `welcome`, `organizer_auth`, `groups` (створення, поширення запрошення, головна групи з живим списком), `join` (приєднання, очікування підтвердження, PIN, повернення; організатор, що відкрив своє посилання, не перезаписує сесію).
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
- Фото зменшує сервер (дизайн 2а п. 13); клієнт надсилає оригінал (ліміт 15 МБ — P3).
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
| WS | `/ws` | сесія | протокол ks_server v1; теми `group:`, `org:`, `member:`; події `member.joined`, `member.removed`, `member.pending` (`org:`), `member.approved` (`member:`) |
| POST | `/test/seed-group` | лише `NODE_ENV=test` | тестова група |

## Моделі даних

Firestore (за репозиторіями): `organizers/{uid}` {email, displayName?}; `sessions/{id}` {subject{kind,id,groupId?}, refreshTokenHash, deviceInfo, createdAt, revokedAt?}; `groups/{id}` {ownerUid, name, timezone, status, settings{approveNew, memberLimit=50, likesCountOnly, departments[]}, inviteTokenHash, inviteClosed}; `groups/{id}/members/{mid}` {displayName, nameKey, status pending|active|removed, isOrganizer, organizerUid?, department?}; `…/members/{mid}/private/secrets` {pinHash?, pinFailures, lockedUntil?}; `groups/{id}/nameIndex/{nameKey}` {memberId} — унікальність імені в транзакції.
Наступні частини (P2–P7): `cells`, `submissions`, `likes`, `comments`, `points`, `standings`, `tasks` — за розділом 12 дизайну.

## Історія версій

- 2.5 (2026-11-27) — P1 перевірено власником на проді.
- 2.4 (2026-11-27) — веб на живому сайті; пакет `com.*`; App Links і Universal Links.
- 2.3 (2026-11-27) — перший деплой API; `FIRESTORE_DATABASE`.
- 2.2 (2026-11-26) — каталог завдань v2 (див. `content/`).
- 2.1 (2026-11-26) — виправлення за фінальним рев'ю P1 (див. вище); App Links / Universal Links підключено у 2.4.
- 2.0 (2026-11-26) — P1: сервер (сесії, вхід організатора, групи, приєднання, PIN, realtime, App Check, сторінка запрошення), застосунок Web/Android/iOS (вхід, створення групи, приєднання, PIN, живий список), каталог 76 завдань, скрипти деплою.
- 1.0 (2026-11-26) — перший огляд за дизайном; коду не було.
