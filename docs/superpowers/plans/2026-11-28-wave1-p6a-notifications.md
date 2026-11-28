# P6a — Сповіщення в застосунку і пуші — план реалізації

> **Для виконавця:** REQUIRED SUB-SKILL: superpowers:executing-plans (нативно, цей сеанс виконує всі задачі, одне фінальне рев'ю) або superpowers:subagent-driven-development. Кроки — з чекбоксами.

**Goal:** гравець бачить сповіщення в застосунку (дзвіночок зі списком, спливні повідомлення, крапки на вкладках) і отримує пуші, коли застосунок закритий (iOS, Android, веб); організатор отримує свої службові сповіщення; налаштування, тихі години й добовий ліміт працюють на сервері.

**Architecture:** сервер зберігає сповіщення кожного учасника (репозиторій пам'ять + Firestore) і створює їх у місцях, де вже відбуваються події гри; пуші шле модуль `push` з `ks_server` v0.4.0 (копія через `sync:push`) через один `PushNotifier`, який застосовує налаштування, тихі години й ліміт. Клієнт: `PushService` і `PushTokenRegistrar` з `ks_core` v0.8.0, дзвіночок і екран «Сповіщення» на `LiveLoader`, платформні налаштування (iOS `aps-environment`, Android-дозвіл, веб service worker) під тестом.

**Tech Stack:** NestJS 11 + TS (jest unit + e2e), `firebase-admin` messaging, Flutter (go_router, ChangeNotifier, `ks_core` push), l10n ARB UA/EN.

**Spec:** `docs/specs/2026-11-19-photo-challenge-design.md` — розділ 8 «Сповіщення і Telegram» (таблиця подій і правила), 2а; roadmap рядок P6. Задача хабу: `mainprojectmanagement/tasks/commandvibe/2026-11-28-push-notifications.md`.

## Global Constraints

- Усі дані — лише через сервер. Поки застосунок відкритий, подію приносить WebSocket і показується всередині застосунку; системний банер у передньому плані не показуємо (спека, розділ 8).
- Ніхто, крім самого учасника, не отримує сповіщень про те, що він чогось **не** зробив: нагадування — лише особисте, без імен інших.
- Поза застосунком — не більше 3 пушів на людину на день, крім особистих (твоя черга, скарга, новий учасник); тихі години 22:00–8:00 за часом групи — пушів немає (у застосунку сповіщення є завжди).
- У пушах і подіях — жодних імен, текстів коментарів, посилань на фото; лише тип, день і маршрут. Токени й ідентифікатори акаунтів у логи не пишемо.
- iOS: у `Runner.entitlements` обов'язково `aps-environment` і `UIBackgroundModes: remote-notification` в `Info.plist` — без цього iOS мовчки не видає APNs-токен (урок medvibe 28.11); перевіряється тестом.
- Рядки лише через ARB (UA і EN); згенеровані файли комітяться; код-коментарі — мінімум, англійською.
- Сервер: `server/scripts/check.sh`; нові репозиторні методи — в обох реалізаціях і в `repositories.contract.ts` (емулятор — `--runInBand`). Застосунок: `app/tool/check.sh`; без симуляторів.
- Не чіпати `ks_core`/`ks_server`: беремо теги v0.8.0 і v0.4.0 (серверний модуль — копією через `npm run sync:push` із чистого клону тегу). Після змін логіки — `.agents/rules/project-overview.md` і звіт `report/` з повним текстом завдання.

## Що входить у P6a і що ні

| Подія (розділ 8) | Кому | У застосунку | Push | P6a |
|---|---|---|---|---|
| Відкрилось завдання дня | усім | ✅ | ✅ | так |
| Твоя черга обирати (рулетка) | обраному | ✅ | ✅ особисте | так |
| Нагадування ввечері | тим, хто не виконав | ✅ | ✅ | так |
| Фото дня відкрились | усім | ✅ | — | так |
| Лайки на твоє фото | автору | ✅ зведено | — | так |
| Коментар до твого фото | автору | ✅ | ✅ | так |
| Організатору: новий учасник чекає, скарга | організатору | ✅ | ✅ особисте | так |
| Тебе обігнали / трійка, спільна ціль, джокер, штурхнути, підсумки, видалення даних | — | — | — | ні (немає основи або пізніше) |
| Telegram-бот, Mini App | — | — | — | ні — P6b (потрібен токен бота від власника) |

## Рішення, яких немає в дизайні (типові варіанти; власник може змінити)

1. **P6a і P6b окремо:** зараз — застосунок і пуші; Telegram-бот і Mini App-вхід — P6b, коли власник створить бота й дасть токен (секрет).
2. **Список сповіщень зберігається на сервері по учасниках;** подія для всіх створює запис кожному активному учаснику в момент події (хто приєднався пізніше — старих не отримує); зберігаємо до 200 останніх на людину.
3. **Текст пуша — українською** (основна мова); мова учасника на сервері невідома, англійські пуші — пізніше.
4. **Тихі години:** пуш у 22:00–8:00 за часом групи пропускаємо, а не відкладаємо; у застосунку запис лишається.
5. **Ліміт:** до 3 неособистих пушів на людину на добу за часом групи; особисті (черга, скарга, новий учасник) ліміт не рахують; коментарі й нагадування рахують.
6. **Лайки** — один запис на фото («N вподобали»), оновлюється, знову стає непрочитаним, коли кількість росте; без пуша.
7. **Нагадування ввечері** — о 19:00 за часом групи, лише якщо день відкритий і гравець ще не виконав, раз на день; запис у застосунку й пуш.
8. **Налаштування** — дві категорії: «завдання» (новий день, розкриття, нагадування, черга) і «лайки й коментарі»; службові сповіщення організатора вимкнути не можна; за замовчуванням усе ввімкнено.
9. **Ідентифікатор акаунта для токенів:** `o:<uid організатора>` для сесії організатора (також коли він грає — сповіщення його учасницького запису йдуть на цей акаунт), `m:<memberId>` для решти; той самий пристрій під іншим акаунтом переходить до нового.
10. **Спливне повідомлення** — стрічка внизу екрана на кілька секунд з події, що прийшла наживо; **крапки на вкладках:** «Стрічка» — нові фото, «Сьогодні» — новий день чи твоя черга, знімаються при відкритті вкладки.
11. **iPhone у браузері** — лише встановлений на головний екран; інакше поясняємо в налаштуваннях і не пропонуємо дозвіл (так працює модуль `needsHomeScreen`).
12. **Кроки власника в консолях** (без них пуші не дійдуть): APNs-ключ `.p8` у Firebase `commandvibe-ks` для iOS-застосунку; в Apple Developer — Push Notifications для App ID `com.karavanstudio.commandvibe`; VAPID-ключ вебу (Firebase → Cloud Messaging → Web Push certificates), публічну частину передати для `--dart-define=VAPID_KEY`.

## Review Focus

1. Жодних імен, текстів і посилань у пушах, подіях і `data`; нагадування не розкриває, хто що не зробив (Task 3–5).
2. Тихі години (межі 22:00/8:00 у поясі групи, перехід на літній час) і ліміт рівно 3 (Task 4).
3. Кожне сповіщення йде лише адресатам: вилучені й ті, що чекають підтвердження, не отримують; службові — лише власнику; черга — лише обраному; коментар не собі (Task 3).
4. Токени: акаунти `o:`/`m:`, перехід токена між акаунтами, скасування реєстрації перед виходом (Task 1, 6).
5. Платформа: `aps-environment`, фонові режими, дозвіл Android, service worker — тестом на файли (Task 7).

---

## Файлова структура

**Сервер (створити):** `server/src/shared/push/` (копія модуля скриптом), `server/src/notifications/` (`notifications.service.ts`, `notification-kinds.ts`, `notifications.controller.ts`, `notifications.module.ts`, `push-notifier.ts`, `quiet-hours.ts`, `reminders.service.ts`, `views.ts`, specs), тести `server/test/push-token.e2e-spec.ts`, `notifications.e2e-spec.ts`, `reminders.e2e-spec.ts`.
**Сервер (змінити):** `package.json` (`sync:push`, `sync:push:check`), `scripts/check.sh`, `app.module.ts` (PushModule), `data/models.ts`, `repositories.ts`, `memory/*`, `firestore/*`, `data.module.ts`, `repositories.contract.ts`, `game/game-engine.ts` (день відкрито, розкриття, черга), `comments/comments.service.ts`, `likes/likes.service.ts`, `members/members.service.ts` (чекає підтвердження), `photos/moderation.service.ts` (скарга), `game/tick` (нагадування), `members` (налаштування), `.github/workflows/server-firestore-contract.yml` (за потреби).
**Клієнт (створити):** `app/lib/core/push/` (`push_setup.dart`, `session_http_client.dart`, `push_navigation.dart`), `app/lib/features/notifications/` (data, `notifications_view_model`, `bell_button.dart`, `notifications_view.dart`, `live_toasts.dart`, `tab_dots.dart`), `app/lib/features/profile/notification_settings_card.dart`, `app/web/firebase-messaging-sw.js`, тести.
**Клієнт (змінити):** `pubspec.yaml` (`ks_core` v0.8.0), `lib/main.dart`, `lib/app.dart`, `core/services_scope.dart`, `core/router.dart`, `core/ui/tab_page.dart` (дзвіночок), `features/shell/group_shell.dart` (крапки, спливні), `core/app_config.dart` (VAPID), `ios/Runner/Runner.entitlements`, `ios/Runner/Info.plist`, `ios/Runner/AppDelegate.swift`, `android/app/src/main/AndroidManifest.xml`, ARB, generated.

---

### Task 1: Сервер — модуль push (токени) і акаунти

**Files:**
- Create: `server/src/shared/push/*` (копія), `server/src/notifications/push-account.ts` (+ spec), `server/test/push-token.e2e-spec.ts`
- Modify: `server/package.json`, `server/scripts/check.sh`, `server/src/app.module.ts`

**Interfaces:**
- Produces: `npm run sync:push` / `sync:push:check` (як `sync:realtime`, із `KS_SERVER_DIR` на чистий клон тегу v0.4.0); `accountIdOf(subject: SessionSubject): string` → `o:<uid>` для `organizer`, `m:<id>` для `member`; `accountIdsOfMember(member: Member): string[]` → `['o:<organizerUid>']` для записів організатора, інакше `['m:<id>']`; `PushModule.forRootAsync` у `AppModule` з `userIdOf` = `accountIdOf(request.auth.subject)`, сховище Firestore в роботі й пам'ять у тестах, `admin.messaging()` у роботі й заглушка в тестах; маршрути `PUT|DELETE /me/push-token`.
- Consumes: `AuthGuard`/`VerifiedAccess` (поле, яке читає `CurrentAuth`), `getFirestore`.

- [ ] **Step 1: Тести** `push-account.spec.ts` (органiзатор → `o:`, учасник → `m:`, учасницький запис організатора → `o:`, звичайний → `m:`); e2e `push-token.e2e-spec.ts`: учасник реєструє токен `PUT /me/push-token {token, platform}` → `204`; без сесії → `401`; довжина/платформа не з переліку → `400`; той самий токен під іншим акаунтом переходить до нового (через `PushTokenStore`); `DELETE` лише власного; сесія організатора теж реєструє.
- [ ] **Step 2: Run:** `cd server && npx jest src/notifications/push-account && npx jest --config test/jest-e2e.json test/push-token` — Expected: FAIL.
- [ ] **Step 3: Implement:** скрипти `sync:push` у `package.json`, запустити синхронізацію (чистий клон тегу v0.4.0 у `KS_SERVER_DIR`), додати `sync-push` у `scripts/check.sh`, `push-account.ts`, підключення `PushModule.forRootAsync` (фабрика обирає сховище й `messaging` за `STORAGE`).
- [ ] **Step 4: Run:** ті самі команди, потім `./scripts/check.sh` — Expected: PASS, усі `ok`.
- [ ] **Step 5: Commit** `feat(push): device tokens through the shared push module`.

---

### Task 2: Сервер — сховище сповіщень і їхній список

**Files:**
- Modify: `data/models.ts`, `repositories.ts`, `memory/memory-repositories.ts`, `firestore/firestore-repositories.ts`, `data.module.ts`, `repositories.contract.ts`
- Create: `server/src/notifications/notification-kinds.ts`, `notifications.service.ts`, `notifications.controller.ts`, `notifications.module.ts`, `views.ts`, `notifications.service.spec.ts`; `server/test/notifications.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Produces: `NotificationKind = 'day_opened' | 'photos_revealed' | 'my_turn' | 'reminder' | 'comment' | 'likes' | 'pending_member' | 'complaint'`; `Notification { id; groupId; memberId /* адресат */; kind; dayIndex?; actorMemberId?; count?; createdAt; readAt? }`; `NotificationRepository { addOnce(n): Promise<boolean>; put(n): Promise<void>; list(groupId, memberId, limit): Promise<Notification[]> /* найновіші першими */; markRead(groupId, memberId, ids?: string[], at): Promise<number>; deleteOlderThanLatest(groupId, memberId, keep: number): Promise<void>; deleteInvolving(groupId, memberId) }` (Firestore: плоска колекція `groups/{g}/notifications`, id `${memberId}_${key}`); `NotificationsService.record(n: NewNotification): Promise<Notification | undefined>` (ідемпотентно за `key`, обрізає до 200); `GET /groups/:id/notifications` → `{ items: { id, kind, dayIndex?, actorName?, actorAvatar?, count?, createdAt, read }[], unread: number }` (імена — з учасників на момент читання; вилучений — без імені); `POST /groups/:id/notifications/read {ids?}` → `204`.
- Consumes: `PhotosService.viewerOf` (учасник чи ні), `MemberRepository`.

- [ ] **Step 1: Контрактні тести** `NotificationRepository`: `addOnce` вдруге → `false`; `put` перезаписує; `list` лише адресата, найновіші першими, з `limit`; `markRead` усіх і за ids, повертає кількість; обрізання до `keep`; `deleteInvolving` (адресат і актор).
- [ ] **Step 2: Unit** `notifications.service.spec.ts`: запис ідемпотентний; 201-й запис видаляє найстаріший; список із `unread` і прочитаними; імена видаленого учасника порожні; `read` позначає лише свої. e2e: учасник бачить лише свої, чужа група `403`, без сесії `401`, організатор, що не грає, має свій (службовий) список за `ownerMemberKey` (див. Step 3).
- [ ] **Step 3: Implement:** репозиторії, сервіс, контролер; адресат організатора, що не грає, — службовий ключ `org:<uid>` у полі `memberId`.
- [ ] **Step 4: Run:** `cd server && npx jest src/data src/notifications && npx jest --config test/jest-e2e.json test/notifications` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(notifications): per-member notification list`.

---

### Task 3: Сервер — де народжуються сповіщення

**Files:**
- Modify: `server/src/game/game-engine.ts`, `comments/comments.service.ts`, `likes/likes.service.ts`, `members/members.service.ts`, `photos/moderation.service.ts`, відповідні модулі; `notifications.service.ts` (допоміжні методи)
- Create: `server/src/notifications/notification-sources.spec.ts`; доповнити `server/test/notifications.e2e-spec.ts`

**Interfaces:**
- Consumes: `NotificationsService.record`, `PushNotifier.send` (Task 4 — у цій задачі виклик через інтерфейс `NotificationSink`, реалізований у Task 4).
- Produces: `NotificationsService.dayOpened(groupId, dayIndex)`, `photosRevealed(groupId, dayIndex)`, `myTurn(groupId, dayIndex, memberId)`, `comment(groupId, dayIndex, photoAuthorId, commenterId)`, `likes(groupId, dayIndex, photoAuthorId)` (перераховує кількість), `pendingMember(groupId, memberId)`, `complaint(groupId, dayIndex, authorMemberId)` — кожен обирає адресатів і ключ ідемпотентності; виклики вставлені в `GameEngine` (відкриття дня, розкриття, очікування вибору), `CommentsService.add`, `LikesService.set`, `MembersService.join` (статус `pending`), `ModerationService.complain`.

- [ ] **Step 1: Unit-тести** (Review Focus 3): день відкрито → запис кожному активному гравцю, не вилученим і не «чекає»; черга → лише обраному; коментар → лише автору фото й не собі; лайк → один запис на фото, `count` зростає, знову непрочитаний, лайк собі/неактивного не рахується; новий учасник на підтвердженні й скарга → лише власнику (ключ `org:<uid>`); повторна подія з тим самим ключем не дублює; видалені гравці не отримують.
- [ ] **Step 2: Run:** `cd server && npx jest src/notifications` — Expected: FAIL.
- [ ] **Step 3: Implement** методи й вставити виклики у п'ять місць; помилка запису сповіщення не ламає основну дію (лог без даних).
- [ ] **Step 4: e2e:** після виконання дня й коментаря — `GET /notifications` показує записи правильним людям; нічого зайвого.
- [ ] **Step 5: Run:** `cd server && npx jest src/notifications && npx jest --config test/jest-e2e.json test/notifications test/likes test/comments` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(notifications): record events where the game produces them`.

---

### Task 4: Сервер — налаштування, тихі години, ліміт і відправка пушів

**Files:**
- Create: `server/src/notifications/quiet-hours.ts`, `push-notifier.ts`, `preferences.ts`, specs; `server/test/notification-settings.e2e-spec.ts`
- Modify: `data/models.ts` (`Member.notify`), `members.controller.ts`/`members.service.ts`, `notifications.service.ts`, `notifications.module.ts`

**Interfaces:**
- Produces: `inQuietHours(at: Date, timeZone: string): boolean` (22:00 ≤ t < 08:00 локального часу групи, DST враховано); `localDayStart(at, timeZone): Date`; `NotificationPrefs { tasks: boolean; social: boolean }` (за замовчуванням обидва `true`) і `PUT /groups/:id/me/notification-settings` `{ tasks?, social? }` → `204`, `GET` у `GET /groups/:id/me/notification-settings`; `PushNotifier.send(group, recipients, kind, dayIndex?)` — фільтрує за налаштуваннями, тихими годинами, ліміт 3 неособистих пушів на людину на локальну добу (особисті: `my_turn`, `complaint`, `pending_member`), будує український текст і `data { route, kind }` без імен, викликає `PushService.sendToUsers(accounts, content)` й помилку відправки лише логує; пуш лише для видів із таблиці (`day_opened`, `my_turn`, `reminder`, `comment`, `pending_member`, `complaint`).
- Consumes: `PushService` (Task 1), `accountIdsOfMember` (Task 1), `NotificationRepository.list` (рахує вже надіслані: запис має `pushedAt`).

- [ ] **Step 1: Тести** (Review Focus 2): `inQuietHours` на межах 21:59/22:00, 07:59/08:00, у `Europe/Kyiv` у лютому й на переході на літній час; `localDayStart`; `PushNotifier`: вимкнена категорія → без пуша, але запис лишається; тиха година → без пуша; четвертий неособистий за добу → без пуша, особистий — є; текст і `data` не містять імен і текстів; організатор що не грає отримує службовий пуш на `o:<uid>`; помилка `sendToUsers` не падає. e2e налаштувань: вмикання/вимикання, чужа група `403`, невалідне тіло `400`.
- [ ] **Step 2: Run:** `cd server && npx jest src/notifications` — Expected: FAIL.
- [ ] **Step 3: Implement** модулі й підключити `PushNotifier` як реалізацію `NotificationSink` з Task 3 (пуш після запису, `pushedAt` у записі).
- [ ] **Step 4: Run:** `cd server && npx jest src/notifications && npx jest --config test/jest-e2e.json test/notification-settings test/notifications` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(notifications): preferences, quiet hours, daily cap and push delivery`.

---

### Task 5: Сервер — вечірнє нагадування

**Files:**
- Create: `server/src/notifications/reminders.service.ts`, `reminders.service.spec.ts`; `server/test/reminders.e2e-spec.ts`
- Modify: `server/src/game/tick` (виклик у наявному `/internal/tick`), `notifications.module.ts`

**Interfaces:**
- Produces: `RemindersService.run(now: Date): Promise<number>` — для кожної групи з відкритим сьогоднішнім днем, якщо локальний час ≥ 19:00 і < 22:00 (до тихих годин), кожному активному гравцю без виконання створює `reminder` (ключ `reminder_<day>_<member>`, раз на день) і шле пуш через `PushNotifier`; повертає кількість створених; текст — «Сьогодні ще чекає завдання», без чисел про інших.
- Consumes: `NotificationsService.record`, `PushNotifier`, `GroupRepository.listWithGame`, `CellRepository`, `SubmissionRepository.listDay`.

- [ ] **Step 1: Тести** (Review Focus 1–2): о 18:59 нічого, о 19:00 — тим, хто не виконав, не тим, хто виконав і не вилученим; повторний запуск не дублює; о 22:00 не шле; день не відкрито — нічого; завершена гра — нічого; текст пуша без чисел і імен; різні пояси груп. e2e: два учасники, один виконав — `/internal/tick` з годинником після 19:00 створює нагадування лише другому.
- [ ] **Step 2: Run:** `cd server && npx jest src/notifications/reminders` — Expected: FAIL.
- [ ] **Step 3: Implement** сервіс і підключити до `tick`.
- [ ] **Step 4: Run:** `cd server && npx jest src/notifications && npx jest --config test/jest-e2e.json test/reminders test/tick && ./scripts/check.sh` — Expected: PASS, усі `ok`.
- [ ] **Step 5: Commit** `feat(notifications): evening reminder for those who have not done the day`.

---

### Task 6: Клієнт — `ks_core` 0.8.0, PushService, реєстрація токена

**Files:**
- Create: `app/lib/core/push/push_setup.dart`, `session_http_client.dart`; тести `app/test/core/push/*`
- Modify: `app/pubspec.yaml`, `app/lib/main.dart`, `app/lib/app.dart`, `app/lib/core/services_scope.dart`, `app/lib/core/app_config.dart`

**Interfaces:**
- Consumes: `ks_core` `PushService`/`FirebasePushService`, `LocalNotifications`, `PushTokenRegistrar`, `registerPushBackgroundHandler`; `ApiClient.accessToken`, `SessionStore`/`ObservedSessionStore`.
- Produces: `SessionHttpClient extends http.BaseClient` (додає `Authorization: Bearer <accessToken>` з `ApiClient.accessToken()`, на `401` пробує оновлений токен один раз); `AppServices.push: PushService` і `AppServices.pushRegistrar`; `PushSetup.start(services)` — створює `FirebasePushService(options: …VAPID…)`, прив'язує `PushTokenRegistrar.bind(accountIdStream)` до сесії (`o:`/`m:` як у сервера), реєструє фоновий обробник; `AppConfig.vapidKey` з `--dart-define=VAPID_KEY` (порожній → веб «не налаштовано», тихо); `unregister()` перед виходом з групи/виходом організатора.

- [ ] **Step 1: Тести:** `SessionHttpClient` додає токен, повторює один раз після `401`, не додає токен без сесії; потік акаунта з сесії (`o:`/`m:`/`null` після виходу); вихід викликає `unregister` до очищення сесії (фейкові сервіси з `FakePushService`); порожній VAPID не падає.
- [ ] **Step 2: Run:** `cd app && flutter test test/core/push` — Expected: FAIL.
- [ ] **Step 3: Implement:** перехід `ks_core` на `v0.8.0` (`flutter pub get`, перевірити, що Flutter ≥ 3.38.1), код, підключення в `main.dart`/`app.dart`.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): push service and token registration through the session`.

---

### Task 7: Клієнт — платформні налаштування пушів (iOS, Android, веб) під тестом

**Files:**
- Create: `app/web/firebase-messaging-sw.js`; `app/test/core/platform/push_platform_config_test.dart`
- Modify: `app/ios/Runner/Runner.entitlements`, `app/ios/Runner/Info.plist`, `app/ios/Runner/AppDelegate.swift`, `app/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: у `Runner.entitlements` — `aps-environment`; в `Info.plist` — `UIBackgroundModes` з `remote-notification`; у `AppDelegate.swift` — явний `UIApplication.shared.registerForRemoteNotifications()` після реєстрації плагінів; в `AndroidManifest.xml` — `android.permission.POST_NOTIFICATIONS` і канал за замовчуванням `default_notification_channel_id`; `web/firebase-messaging-sw.js` з не-секретним конфігом проєкту `commandvibe-ks` (той самий, що в `AppConfig`) і показом сповіщення лише коли вкладка не в фокусі.
- Consumes: нічого.

- [ ] **Step 1: Тест** `push_platform_config_test.dart` читає файли (`dart:io`, відносно `app/`): entitlements містять `aps-environment`; `Info.plist` — `remote-notification` у `UIBackgroundModes`; `AppDelegate.swift` — `registerForRemoteNotifications`; manifest — `POST_NOTIFICATIONS`; service worker існує й містить `importScripts` Firebase та `messagingSenderId` проєкту.
- [ ] **Step 2: Run:** `cd app && flutter test test/core/platform/push_platform_config_test.dart` — Expected: FAIL.
- [ ] **Step 3: Implement** зміни файлів (SW — версія `firebase-js-sdk` як у `ks_core`/FlutterFire-документації).
- [ ] **Step 4: Run:** `cd app && flutter test && ./tool/check.sh` — Expected: PASS, збірки web/Android/iOS `ok`.
- [ ] **Step 5: Commit** `feat(app): platform setup for push on iOS, Android and web`.

---

### Task 8: Клієнт — дзвіночок і екран «Сповіщення»

**Files:**
- Create: `app/lib/features/notifications/data/notifications_models.dart`, `notifications_repository.dart`, `app/lib/features/notifications/ui/notification_text.dart`, `bell_button.dart`, `notifications_view.dart`; тести
- Modify: `app/lib/core/ui/tab_page.dart` (slot для дзвіночка), `app/lib/core/realtime/live_loader.dart` (набір подій `notificationEvents`), `app/lib/core/realtime/group_live.dart` (спільний завантажувач сповіщень), `app/lib/core/router.dart` (`/g/:groupId/notifications`), `app/lib/core/services_scope.dart`, ARB

**Interfaces:**
- Consumes: `GET /groups/:id/notifications`, `POST …/read` (Task 2).
- Produces: `AppNotification { id, kind, dayIndex?, actorName?, actorAvatar?, count?, createdAt, read }`, `NotificationsRepository.list(groupId)`/`markRead(groupId, ids)`; `notificationText(l10n, AppNotification)` → український/англійський рядок за видом (без серверного тексту); `notificationRoute(groupId, n)` → маршрут (`day_opened`/`reminder`/`my_turn` → `/g/:id/today`, `photos_revealed`/`likes`/`comment` → `/g/:id/feed`, `pending_member`/`complaint` → `/g/:id/me`); `GroupLive.notifications: LiveLoader<NotificationsPage>` — перечитується на нові події (`notification.created` не додаємо: сервер шле наявні події гри — `day.opened`, `photos.revealed`, `like.changed`, `comment.*`, `member.joined|pending`, `complaint.created`, `roulette.*`); `BellButton` із лічильником; `NotificationsView` — згруповано за днями, дотик відкриває маршрут і позначає прочитаним.

- [ ] **Step 1: Тести:** розбір моделей; `notificationText` для кожного виду (UA і EN) і невідомого виду; `notificationRoute`; `BellButton` (0 — без значка, 3 — «3», 120 — «99+»); `NotificationsView`: порожній стан, групування за днем, дотик викликає навігацію й `markRead`, прочитані виглядають інакше; `GroupLive` перечитує сповіщення на `like.changed` і `day.opened`.
- [ ] **Step 2: Run:** `cd app && flutter test test/features/notifications test/core/realtime` — Expected: FAIL.
- [ ] **Step 3: Implement** модель, репозиторій, тексти, дзвіночок у `TabPage`, екран і маршрут.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): notification bell and list`.

---

### Task 9: Клієнт — спливні повідомлення, крапки на вкладках, відкриття з пуша

**Files:**
- Create: `app/lib/features/notifications/ui/live_toasts.dart`, `tab_dots.dart`, `app/lib/core/push/push_navigation.dart`; тести
- Modify: `app/lib/features/shell/group_shell.dart`, `app/lib/core/ui/adaptive_shell.dart` (крапка на вкладці), `app/lib/core/push/push_setup.dart`

**Interfaces:**
- Consumes: `FakePushService.opened`/`foregroundMessages`, події групи, `GroupLive.notifications`.
- Produces: `LiveToasts` — слухає події групи у передньому плані і показує `SnackBar` («Новий день відкрито», «Тобі обирати завдання», «Новий коментар»); для подій, які викликала сама людина, нічого; `TabDots` — множина вкладок із крапкою (`feed` після `submission.created|replaced` від інших, `today` після `day.opened`/`roulette.waiting` для тебе), знімається при відкритті вкладки; `AdaptiveShell.tabs[i].badge: bool`; `PushNavigation` — `opened`-події (включно з холодним стартом) → `router.go(route)` лише для маршрутів вигляду `/g/<id>/…` поточної групи (сторонні чи зламані ігноруються), системний банер у передньому плані не показується (`foregroundMessages` ніколи не перетворюється на локальне сповіщення).

- [ ] **Step 1: Тести:** `TabDots` — крапка з'являється й зникає; не від власної дії; `PushNavigation` — відкриває маршрут групи, ігнорує чужий хост/групу/сміття, холодний старт; `LiveToasts` — текст за подією, мовчить на власну; `AdaptiveShell` малює значок.
- [ ] **Step 2: Run:** `cd app && flutter test test/features/notifications test/core/push test/features/shell` — Expected: FAIL.
- [ ] **Step 3: Implement** і підключити до `GroupShell`/`PushSetup`.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): live toasts, tab dots and opening from a push`.

---

### Task 10: Клієнт — налаштування сповіщень у «Я»

**Files:**
- Create: `app/lib/features/profile/notification_settings_card.dart`, `notification_settings_view_model.dart`; тести
- Modify: `app/lib/features/profile/profile_view.dart`, `app/lib/features/groups/data/groups_repository.dart` (`notificationSettings`/`setNotificationSettings`), ARB

**Interfaces:**
- Consumes: `PushService.support()/permission()/requestPermission()`, `GET|PUT /groups/:id/me/notification-settings` (Task 4).
- Produces: `NotificationSettingsViewModel` — стан пуша (`unsupported`, `needsHomeScreen`, `notConfigured`, `denied`, `off`, `on`), `enablePush()` (запит дозволу за жестом, потім `registrar.sync()`), перемикачі «Завдання» і «Лайки й коментарі» з оптимістичним відкатом; `NotificationSettingsCard` — пояснення для кожного стану (iPhone: «додай гру на головний екран»; заблоковано: «дозволь у налаштуваннях»).

- [ ] **Step 1: Тести:** стани з `FakePushService`; `enablePush` просить дозвіл і синхронізує токен; відмова → `denied`; перемикачі шлють значення й відкочуються при помилці; організатор, що не грає, перемикачів категорій не бачить (лише стан пуша).
- [ ] **Step 2: Run:** `cd app && flutter test test/features/profile` — Expected: FAIL.
- [ ] **Step 3: Implement** модель, картку й вставити у `ProfileView`.
- [ ] **Step 4: Run:** `cd app && dart format lib test && flutter analyze && flutter test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): notification settings and push permission`.

---

### Task 11: Наскрізна перевірка, документація, звіт

**Files:**
- Modify: `tool/e2e_web.mjs`, `.agents/rules/project-overview.md`, `report/report_<дата_час>.md`, `docs/deploy.md` (кроки власника для пушів)

- [ ] **Step 1: Розширити `tool/e2e_web.mjs`:** після виконання дня другим учасником у першого з'являється сповіщення в дзвіночку (лічильник), екран «Сповіщення» показує запис і веде на вкладку; коментар створює сповіщення автору (через API); налаштування «Завдання» вимкнено — нових `day_opened` записів не лишає пуша (перевірка через API-список лишається, пуш — через фейк на сервері в unit).
- [ ] **Step 2: Run:** `cd server && ./scripts/check.sh`, `cd app && ./tool/check.sh`, e2e-скрипт на свіжих збірках — Expected: усе `ok`.
- [ ] **Step 3: Контракти на емуляторі** (Docker, `--runInBand`) для `NotificationRepository` і `PushTokenStore` — Expected: усі проходять.
- [ ] **Step 4: Документація:** `project-overview.md` (версія, маршрути, події, правила пушів, платформні налаштування), `docs/deploy.md` (кроки власника: APNs `.p8`, Push Notifications у App ID, VAPID, `--dart-define=VAPID_KEY`), звіт з повним текстом завдання, запитом синхронізації клієнта й рішеннями 1–12.
- [ ] **Step 5: Commit** `docs(p6a): overview, deploy steps, report and full-flow browser check`.

---

## Самоперевірка плану

- **Покриття:** токени й `PUT /me/push-token` (Task 1, 6), сповіщення в застосунку (2, 3, 8), пуші з ліміт-правилами (4), нагадування (5), платформа iOS/Android/веб (7), спливні й крапки (9), налаштування (10), документація/кроки власника (11). Поза P6a: Telegram-бот, Mini App (P6b), обігнали/трійка/ціль/джокер/штурхнути/підсумки/видалення даних.
- **Типи:** `accountIdOf`/`accountIdsOfMember` (Task 1) — єдині у Task 3–5 і клієнтському `PushSetup` (Task 6); `Notification`/`AppNotification` (2 ↔ 8) мають однаковий набір видів.
- **Пропорція:** сервер — тонкі шари над наявними подіями; пуш-доставка в одному класі `PushNotifier`.
