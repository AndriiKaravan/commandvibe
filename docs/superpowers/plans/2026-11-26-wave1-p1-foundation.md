# CommandVibe P1 — фундамент: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Організатор входить через Google і створює групу; учасник входить за посиланням (ім'я, PIN) на вебі, Android та iOS; живі події групи йдуть через realtime; сервер розгортається ревізією `candidate`.

**Architecture:** NestJS-сервер з репозиторіями за інтерфейсами (in-memory для тестів, Firestore для роботи), власні сесії (короткий токен доступу + токен оновлення, у базі лише хеш), realtime з ks_server. Flutter-застосунок feature-first, MVVM на ChangeNotifier, go_router, абстракції платформ у `core/platform`.

**Tech Stack:** NestJS 11, TypeScript 5.9, jest, supertest, ws, firebase-admin, argon2, jose; Flutter 3.41 (Web/Android/iOS), ks_core v0.6.2 (git-тег), go_router, http, shared_preferences, flutter_secure_storage, app_links, firebase_auth.

**Spec:** `docs/specs/2026-11-19-photo-challenge-design.md` — розділи 2а, 5, 6, 12. Дорожня карта: `docs/superpowers/plans/2026-11-26-wave1-roadmap.md`.

## Global Constraints

- Клієнт не звертається до Firestore/Storage; Firebase на клієнті — лише Auth (і App Check) (2а п. 6).
- Токени запрошень і посилання групи — 128 біт, у базі лише SHA-256; PIN — argon2, 5 помилок → блок на 15 хв (розділ 6).
- «Підтверджувати нових» — **вимкнено** за замовчуванням; «Я теж граю» — **увімкнено** за замовчуванням (2а п. 5, розділ 6).
- Ім'я унікальне в групі (без урахування регістру й пробілів по краях), до 40 символів.
- Firebase-проєкт `commandvibe-ks`; Firestore і Cloud Run — `europe-central2`.
- Спільні бібліотеки — лише копії з чистих клонів тегів (`KS_SERVER_DIR`, `KS_CORE_DIR`) і pubspec git-тег; робочі папки `own/ks_core`, `own/ks_server` не чіпати.
- Секрети — Secret Manager (`SESSION_SIGNING_KEY`); у репо — нічого.
- Код Flutter збирається для web, Android, iOS у кожній задачі, що чіпає `app/`; `package:web`/`dart:js_interop` — лише у файлах `*_web.dart`.
- Коментарі — англійською й лише «чому»; тексти UI — UA (EN — хвиля 2, але рядки одразу через `l10n`).

## Review Focus

- **Два учасники одночасно беруть те саме ім'я** — один отримує `409 name_taken`, дубля немає (транзакція в репозиторії). Тест — Task 5.
- **Токен оновлення використано двічі (вкрадений або повтор після обриву мережі)** — другий раз `401`, уся сесія відкликана. Тест — Task 3.
- **Учасника вилучено, а сокет відкритий** — сокет закривається одразу (`4403`), підписка на `group:<id>` стає `denied/revoked`. Тест — Task 6.
- **Перевипущене/закрите посилання групи** — старий токен дає `410 invite_closed`, не `500`. Тест — Task 4.
- **Учасник з PIN-блоком пробує вхід з іншого пристрою** — `429` з `retryAfterSeconds`, лічильник не скидається новим запитом. Тест — Task 5.

---

### Task 1: Каркас репо, сервер `/health`, правила Firebase

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/tsconfig.build.json`, `server/jest.config.js`, `server/eslint.config.mjs`, `server/.prettierignore`, `server/src/main.ts`, `server/src/app.module.ts`, `server/src/health/health.controller.ts`
- Create: `server/test/health.e2e-spec.ts`
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`
- Create (sync): `server/src/shared/realtime/*` (`npm run sync:realtime`), `server/src/shared/app_check/*` (`npm run sync:app-check`)

**Interfaces:**
- Produces: `GET /health` → `200 {"ok":true}`; npm scripts `test`, `test:e2e`, `lint`, `typecheck`, `sync:realtime`, `sync:realtime:check`, `sync:app-check`, `sync:app-check:check`.

- [ ] **Step 1:** Скрипти sync — як у спайку: `node ${KS_SERVER_DIR:?…}/scripts/sync.mjs realtime src/shared/realtime` і `node ${KS_CORE_DIR:?…}/server/app_check/sync/sync-app-check.mjs src/shared/app_check`. Клони: `git clone --depth 1 --branch v0.3.0 git@github.com:AndriiKaravan/ks_server.git` і `--branch v0.6.2 …/ks_core.git` у scratchpad. `src/shared/` — у `.prettierignore` і eslint ignores до першого `npm run lint`.
- [ ] **Step 2: Failing test** `test/health.e2e-spec.ts`: `it('should answer ok')` → `GET /health` → `200`, тіло `{ ok: true }`.
- [ ] **Step 3:** Run `npm run test:e2e` → FAIL (немає контролера).
- [ ] **Step 4:** `HealthController.health(): { ok: true }`, позначений `@Public()` (метадані `isPublic`, щоб AppCheckGuard його не перевіряв). `main.ts`: `enableShutdownHooks()`, CORS з `ALLOWED_ORIGINS`.
- [ ] **Step 5:** `firestore.rules` і `storage.rules` — `allow read, write: if false;` для всього. `.firebaserc` → `commandvibe-ks`; `firebase.json` hosting site `commandvibe-ks`, `public: app/build/web`; rewrite `/j/**` → Cloud Run `commandvibe-api` (europe-central2) для сторінки запрошення, решта — `index.html`; `/api/**` і `/ws` не потрібні (клієнт ходить на URL Cloud Run напряму).
- [ ] **Step 6:** Run `npm test && npm run test:e2e && npm run lint && npm run typecheck && npm run sync:realtime:check` → усе PASS.
- [ ] **Step 7:** Commit `chore(server): scaffold NestJS service, health, deny-all Firebase rules`.

### Task 2: Репозиторії (інтерфейси, in-memory, Firestore) з контрактними тестами

**Files:**
- Create: `server/src/data/models.ts`, `server/src/data/repositories.ts` (інтерфейси + токени DI), `server/src/data/memory/*.ts`, `server/src/data/firestore/*.ts`, `server/src/data/data.module.ts`
- Test: `server/src/data/repositories.contract.ts` (спільний набір), `memory.spec.ts`, `firestore.spec.ts` (Firestore emulator, пропускається без `FIRESTORE_EMULATOR_HOST`)

**Interfaces:**
- Produces (моделі за розділом 12): `Organizer {uid, email, createdAt}`, `Session {id, subject: {kind:'organizer'|'member', id, groupId?}, refreshTokenHash, deviceInfo, createdAt, revokedAt?}`, `Group {id, ownerUid, name, timezone, status:'draft'|'active'|'finished', settings: GroupSettings, inviteTokenHash, inviteClosed, createdAt}`, `GroupSettings {approveNew:false, memberLimit:50, likesCountOnly:false, departments: string[]}`, `Member {id, groupId, displayName, nameKey, avatar?, department?, status:'pending'|'active'|'removed', isOrganizer, createdAt}`, `MemberSecrets {pinHash?, pinFailures, lockedUntil?}`.
- `OrganizerRepository.upsert(o)`, `.get(uid)`; `SessionRepository.create(s)`, `.get(id)`, `.update(id, patch)`, `.revokeAllFor(subjectId)`; `GroupRepository.create(g)`, `.get(id)`, `.update(id, patch)`, `.findByInviteHash(hash)`; `MemberRepository.createUnique(m): Promise<Member>` (кидає `NameTakenError`), `.get(groupId, id)`, `.findByName(groupId, nameKey)`, `.list(groupId)`, `.update(groupId, id, patch)`, `.secrets(groupId, id)`, `.updateSecrets(groupId, id, patch)`.

- [ ] **Step 1: Failing contract tests** `describeRepositories(factory)`: `should keep names unique per group under concurrency` (два `createUnique` з `' Olena '` і `'olena'` через `Promise.allSettled` → рівно один fulfilled, другий `NameTakenError`); `should allow the same name in another group`; `should find a group by invite hash`; `should revoke all sessions of a subject`.
- [ ] **Step 2:** Run `npx jest src/data` → FAIL.
- [ ] **Step 3:** In-memory — `Map`; Firestore — `nameKey` унікальний через документ-індекс `groups/{gid}/nameIndex/{nameKey}` у транзакції; `nameKey = displayName.trim().toLocaleLowerCase()`.
- [ ] **Step 4:** Run `npx jest src/data` (і з емулятором: `firebase emulators:exec --only firestore "npx jest src/data"`) → PASS.
- [ ] **Step 5:** Commit `feat(server): repositories behind interfaces with memory and Firestore`.

### Task 3: Сесії й AuthGuard

**Files:**
- Create: `server/src/auth/session.service.ts`, `server/src/auth/auth.guard.ts`, `server/src/auth/current-subject.decorator.ts`, `server/src/auth/auth.controller.ts`
- Test: `server/src/auth/session.service.spec.ts`, `server/test/auth.e2e-spec.ts`

**Interfaces:**
- Produces: `SessionService.issue(subject, deviceInfo): Promise<{accessToken: string, refreshToken: string, expiresAt: number}>`; `.verifyAccess(token): Promise<{sessionId, subject, expiresAt}>`; `.refresh(refreshToken): Promise<same as issue>`; `.revoke(sessionId)`; `.revokeSubject(subjectId)`.
- Access token — JWT HS256 (jose), 15 хв, claims `sid`, `sub`, `kind`, `gid?`; ключ `SESSION_SIGNING_KEY`. Refresh token — `<sessionId>.<32 байти base64url>`, у базі SHA-256, ротація при кожному `refresh`.
- `POST /auth/refresh {refreshToken}` → нова пара; `POST /auth/logout`. `AuthGuard` (глобальний, `@Public()` — виняток) кладе `subject` у request; `verifyAccess` також перевіряє `session.revokedAt`.

- [ ] **Step 1: Failing tests:** `should issue tokens that verify`; `should reject an access token after revoke` (відкликання діє одразу — design розділ 6); `should rotate the refresh token`; `should revoke the whole session when an old refresh token is reused` (повтор → `UnauthorizedException`, потім і новий refresh → `401`); `should reject an expired access token` (fake timers +15 хв +1 с).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(server): own sessions with rotating refresh tokens`.

### Task 4: Вхід організатора і групи з посиланням-запрошенням

**Files:**
- Create: `server/src/firebase/firebase.service.ts` (firebase-admin init, `verifyIdToken`), `server/src/organizers/organizer-auth.controller.ts`, `server/src/groups/groups.service.ts`, `server/src/groups/groups.controller.ts`, `server/src/common/tokens.ts`
- Test: `server/src/groups/groups.service.spec.ts`, `server/test/groups.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 2 репозиторії, Task 3 `SessionService.issue`.
- Produces: `POST /auth/organizer {idToken}` → `{accessToken, refreshToken, expiresAt, organizer:{uid,email}}` (провайдер `google.com` або `password`/email-link; інакше `403`). `POST /groups {name, timezone, playsToo=true, approveNew=false}` → `{group, inviteUrl}`, де `inviteUrl = ${PUBLIC_APP_URL}/j/<token>`; при `playsToo` створюється `Member{isOrganizer:true, status:'active'}` з ім'ям з `displayName` Google. `POST /groups/:id/invite/rotate` → новий `inviteUrl`, старий хеш недійсний; `POST /groups/:id/invite/close`. `GET /groups/:id` (власник або активний учасник).
- `tokens.ts`: `newToken(): string` (16 байт `randomBytes`, base64url), `hashToken(t): string` (SHA-256 hex), `safeEqual`.

- [ ] **Step 1: Failing tests:** `should create a group with the organizer as a playing member by default`; `should not add the organizer when playsToo is false`; `should keep only the hash of the invite token` (у репозиторії немає сирого токена); `should invalidate the old invite after rotate` (старий → `410 invite_closed` на `POST /join`, Task 5); `should forbid group settings to a non-owner` (`403`). `FirebaseService` у тестах — fake з `verifyIdToken`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(server): organizer sign-in and groups with invite links`.

### Task 5: Приєднання за посиланням, підтвердження нових, PIN

**Files:**
- Create: `server/src/members/invite-page.controller.ts`, `server/src/members/invite-page.html.ts`
- Create: `server/src/members/join.controller.ts`, `server/src/members/members.service.ts`, `server/src/members/pin.service.ts`, `server/src/members/members.controller.ts`
- Test: `server/src/members/members.service.spec.ts`, `server/src/members/pin.service.spec.ts`, `server/test/join.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 2, 3, 4.
- Produces: `GET /join/:token` → `{groupName, memberCount, approveNew}` (для екрана й прев'ю; `410` для закритого). `POST /join {token, displayName, department?}` (`department` — лише зі списку `settings.departments`, інакше `422`) → `201 {member, accessToken, refreshToken, expiresAt}`; `status:'pending'`, якщо `approveNew`. Помилки: `409 name_taken`, `410 invite_closed`, `422 group_full`. `PUT /me/pin {pin}` (рівно 4 цифри → інакше `422`). `POST /join/returning {token, displayName, pin}` → сесія; невірний PIN → `401 {attemptsLeft}`; 5-та помилка → `429 {retryAfterSeconds: 900}`. Організатор: `POST /groups/:id/members/:mid/approve`, `POST …/remove` (→ `SessionService.revokeSubject` + `RealtimeService.disconnectUser`), `POST …/reset-pin`, `PATCH …/name`.
- `PinService.hash(pin)`, `.verify(hash, pin)` — argon2id.
- **Сторінка запрошення** (дизайн 2а п. 12, `@Public()`): `GET /j/:token` → `text/html`, `Cache-Control: no-store`, `<meta name="robots" content="noindex">`; OG: `og:title` = «Вас запросили в гру "<назва>"», `og:description` = «<N> учасників · CommandVibe», `og:image` = `${PUBLIC_APP_URL}/og/invite.png`; тіло — назва і кнопка «Відкрити», скрипт одразу переходить на `${PUBLIC_APP_URL}/join?t=<token>` (застосунок — `usePathUrlStrategy()`). Назва групи екранується (`escapeHtml`). Закрите/невідоме посилання — `410`, та сама сторінка з «Посилання більше не діє», без назви групи.

- [ ] **Step 1: Failing tests:** `should join as active when approveNew is off`; `should join as pending when approveNew is on`; `should reject a taken name with 409`; `should refuse a full group with 422`; `should lock after 5 wrong PINs for 15 minutes` (fake time: 6-та спроба з вірним PIN теж `429`; через 15 хв +1 с — успіх); `should not reset the failure counter on a new request`; `should revoke sessions when the organizer removes a member`; `invite page should put the escaped group name into og:title` (назва `<script>"&` → `&lt;script&gt;&quot;&amp;`); `invite page should answer 410 without the group name for a closed invite`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(server): join by group link with optional approval and PIN`.

### Task 6: Realtime групи

**Files:**
- Modify: `server/src/app.module.ts` (`RealtimeModule.forRootAsync`)
- Create: `server/src/realtime/realtime-access.ts`
- Test: `server/test/realtime.e2e-spec.ts` (реальний `ws`-клієнт протоколу v1 — кадри з `src/shared/realtime/protocol.ts`)

**Interfaces:**
- Consumes: Task 3 `verifyAccess`, Task 2 `MemberRepository`.
- Produces: `/ws`; `verifyToken` → `{userId: subject.id, expiresAt}`; `authorizeSubscribe(session, 'group:<gid>')` → true лише для `active` учасника цієї групи або власника групи. Події: `member.joined {memberId}`, `member.pending {memberId}` (лише організатору — тема `org:<gid>`), `member.removed {memberId}`. Опції: `allowedOrigins` з `ALLOWED_ORIGINS`, `trustedProxyHops: 1`.

- [ ] **Step 1: Failing tests:** `should deliver member.joined to members of the group`; `should deny group topic to a pending member`; `should deny another group's topic`; `should close the removed member's socket with 4403`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(server): realtime topics for groups`.

### Task 7: Ядро клієнта — платформи, сесія, API, realtime, тема «Скло»

**Files:**
- Create: `app/` (`flutter create --platforms web,android,ios --org dev.karavanstudio --project-name commandvibe`), iOS: target 15.0 + `EXCLUDED_ARCHS[sdk=iphonesimulator*] = x86_64` (Podfile post_install і `Flutter/*.xcconfig`, причина — у дорожній карті)
- Create: `app/lib/core/platform/session_store.dart` (+ `_web.dart`, `_io.dart`), `invite_link_source.dart` (+ `_web.dart`, `_io.dart`), `photo_source.dart`
- Create: `app/lib/core/api/api_client.dart`, `app/lib/core/api/api_exception.dart`, `app/lib/core/realtime/realtime_provider.dart`, `app/lib/core/theme/glass_tokens.dart`, `app/lib/core/theme/app_theme.dart`, `app/lib/core/theme/glass_panel.dart`, `app/lib/core/router.dart`
- Test: `app/test/core/api_client_test.dart`, `app/test/core/glass_panel_test.dart`

**Interfaces:**
- Produces: `abstract interface class SessionStore { Future<StoredSession?> read(); Future<void> write(StoredSession s); Future<void> clear(); }`, `StoredSession {accessToken, refreshToken, expiresAt, kind, groupId?}`. `InviteLinkSource { String? get initialToken; Stream<String> get tokens; }` — у вебі токен з `/join?t=<token>` (куди веде серверна сторінка `/j/…`), у застосунках — з App/Universal Link `https://commandvibe.karavanstudio.dev/j/<token>` (застосунок перехоплює посилання раніше за браузер). `ApiClient(baseUri, SessionStore, {http.Client?})`: `get/post/put/patch/delete<T>(path, {body, decode})`, додає `authorization` і `x-realtime-session`, на `401` один раз викликає `/auth/refresh` і повторює запит; паралельні `401` чекають один refresh. `RealtimeProvider` створює `RealtimeClient` з ks_core (`tokenProvider` → `SessionStore.read()`, `authChanged()` після входу/виходу). `GlassTokens` (ThemeExtension: `blurSigma: 18`, `fillDark: 0x14FFFFFF`, `fillLight: 0x8CFFFFFF`, `borderDark`, `borderLight`, `radius: 20`, `blurEnabled`), `GlassPanel` бере їх з теми; `blurEnabled:false` → суцільна підкладка (запасний варіант зі спайку). Значення кольорів — з макетів E/E2 на полотні (2а п. 9). Router: `/join` (з `?t=`), `/org/login`, `/g/:groupId`, redirect на вхід без сесії. `main.dart`: у вебі **не** викликати `Telemetry.install` і замінити `crashSink` на no-op (Crashlytics у вебі не працює — дорожня карта, «винести в бібліотеку» п. 1); у застосунках — `Telemetry.install` як у duval.

- [ ] **Step 1: Failing tests:** `ApiClient should refresh once and retry on 401`; `should share one refresh between parallel 401s` (два запити → один виклик `/auth/refresh`); `should clear the session when refresh fails`; `GlassPanel should not build a BackdropFilter when blur is disabled`.
- [ ] **Step 2:** Run `flutter test test/core` → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Run `flutter analyze && flutter build web && flutter build apk --debug && flutter build ios --simulator --debug` → усі ✓.
- [ ] **Step 6:** Commit `feat(app): core platform abstractions, API client, realtime, glass theme`.

### Task 8: Екрани входу — організатор, учасник, PIN

**Files:**
- Create: `app/lib/features/organizer_auth/{data/organizer_auth_repository.dart, ui/organizer_login_view.dart, ui/organizer_login_view_model.dart}`, `app/lib/core/platform/organizer_sign_in.dart` (+ `_web.dart`: popup, при `auth/popup-blocked` і `auth/operation-not-supported-in-this-environment` → redirect; `_io.dart`: `signInWithProvider`)
- Create: `app/lib/features/groups/{data/groups_repository.dart, ui/create_group_view.dart, ui/create_group_view_model.dart, ui/share_invite_view.dart}`
- Create: `app/lib/features/join/{data/join_repository.dart, ui/join_view.dart, ui/join_view_model.dart, ui/pin_setup_view.dart, ui/returning_view.dart}`
- Create: `app/lib/l10n/app_uk.arb`, `app/lib/l10n/app_en.arb`
- Test: `app/test/features/join/join_view_model_test.dart`, `app/test/features/groups/create_group_view_model_test.dart`, `app/integration_test/join_flow_test.dart`

**Interfaces:**
- Consumes: Task 7 `ApiClient`, `SessionStore`, `InviteLinkSource`, `RealtimeProvider`; Task 4–5 ендпоінти.
- Produces: `JoinViewModel(JoinRepository)`: стани `loading | ready(groupName) | nameTaken | pending | closed | full | joined`; `submit(name)`. `CreateGroupViewModel`: поля `name`, `timezone` (з пристрою), `playsToo=true`, `approveNew=false`; `create()` → `inviteUrl`. Поділитись — `share_plus` (і копіювання посилання).

- [ ] **Step 1: Failing tests:** `JoinViewModel should show nameTaken on 409`; `should show pending when the server returns pending`; `should show closed on 410`; `CreateGroupViewModel should default playsToo to true and approveNew to false`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Integration:** `join_flow_test.dart` — локальний сервер (`npm run start:test`, in-memory репозиторії, `/test/seed-group` лише при `NODE_ENV=test`): відкрити `/join?t=<token>` → ім'я → PIN → бачимо `group:<gid>` активною; другий учасник через API → на екрані з'являється (подія `member.joined`). Run на iOS-симуляторі (`--dart-define=API=http://localhost:3000`) і Android-емуляторі (`http://10.0.2.2:3000`) → PASS; веб — puppeteer-сценарій `tool/e2e_web.mjs` (як `spike/e2e/run.mjs`) → PASS.
- [ ] **Step 6:** Commit `feat(app): organizer sign-in, group creation, join by link with PIN`.

### Task 9: Деплой `candidate` і preview-канал

**Files:**
- Create: `server/Dockerfile` (node:22-slim, `npm ci --omit=dev`, `node dist/main.js`), `server/.dockerignore`, `tool/deploy_api.sh`, `tool/deploy_web_preview.sh`, `docs/deploy.md`

**Interfaces:**
- Produces: `tool/deploy_api.sh` — `gcloud run deploy commandvibe-api --project commandvibe-ks --region europe-central2 --source server --tag candidate --no-traffic --timeout=3600 --concurrency=1000 --min-instances=1 --max-instances=1 --set-secrets SESSION_SIGNING_KEY=session-signing-key:latest --set-env-vars APP_CHECK_MODE=monitor,ALLOWED_ORIGINS=https://commandvibe.karavanstudio.dev,https://commandvibe-ks.web.app,PUBLIC_APP_URL=https://commandvibe.karavanstudio.dev`; друкує URL тегу. Перший запуск (створення сервісу) — без `--no-traffic`, і **лише з «так» власника**. `tool/deploy_web_preview.sh` → `firebase hosting:channel:deploy candidate --expires 7d`.

- [ ] **Step 1:** Секрет `session-signing-key` (64 випадкові байти) — створити з «так» власника (`gcloud secrets create … --data-file=-`, значення не друкувати).
- [ ] **Step 2:** Run `tool/deploy_api.sh` → URL `candidate`; `curl <url>/health` → `{"ok":true}`; `tool/e2e_web.mjs` проти preview-каналу й URL `candidate` → PASS.
- [ ] **Step 3:** Трафік на ревізію — окрема дія з «так» власника/хабу (CLAUDE.md проєкту).
- [ ] **Step 4:** Оновити `.agents/rules/project-overview.md` (версія, API, моделі), звіт у `report/`.
- [ ] **Step 5:** Commit `chore: deploy scripts for candidate revision and web preview`.
