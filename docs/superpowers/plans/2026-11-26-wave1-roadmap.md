# CommandVibe — хвиля 1: дорожня карта

**Дата:** 2026-11-26 · **Дизайн:** `docs/specs/2026-11-19-photo-challenge-design.md` (розділ 2а має пріоритет) · **Перевірка першого дня:** `docs/reports/2026-11-26-day1-spike.md`

Хвиля 1 — це кілька незалежних підсистем, тому вона розбита на **частини P1–P7**. Кожна частина — окремий план із TDD-кроками, який пишеться перед її стартом. Детально розписано **P1** (`2026-11-26-wave1-p1-foundation.md`); P2–P7 нижче — межі, результат і що з чого береться.

## Структура репо (main)

```
app/                      Flutter (Web + Android + iOS з першого дня, дизайн 2а п. 10)
  lib/core/               api_client, session_store, realtime, theme (токени «Скло»), router, platform/*
  lib/features/<feature>/ data/ (repository, dto) + ui/ (view, view_model) — feature-first, MVVM на ChangeNotifier
  integration_test/       сценарії для емулятора/симулятора
server/                   NestJS + TypeScript, Cloud Run europe-central2
  src/modules/<module>/   controller, service, *.repository.ts (інтерфейс), firestore/*.ts (реалізація)
  src/shared/realtime/    копія ks_server (npm run sync:realtime із чистого клону тегу)
  src/shared/app_check/   копія ks_core/server/app_check (так само з чистого клону)
  test/                   e2e (supertest + реальний ws-клієнт)
firebase.json, .firebaserc (commandvibe-ks), firestore.rules / storage.rules ("заборонено все")
docs/
```

## Абстракції платформ (веб ↔ застосунки)

| Що | Інтерфейс у `app/lib/core/platform/` | Веб | Android / iOS |
|---|---|---|---|
| Фото | `PhotoSource.pick(PhotoOrigin)` → `PickedPhoto(bytes, name)` | image_picker (`capture` у `<input>`) | image_picker (камера/галерея) |
| Посилання-запрошення | `InviteLinkSource.initial` / `.stream` | `Uri.base` | `app_links` (App Links / Universal Links) |
| Сповіщення | `PushChannel.register()` → токен або `unsupported` | FCM web push + service worker | FCM (APNs) |
| Сесія | `SessionStore.read/write/clear` | shared_preferences (localStorage) | flutter_secure_storage |
| Вхід організатора | `OrganizerSignIn.google()` / `.emailLink()` | Firebase Auth popup → redirect | Firebase Auth `signInWithProvider` |
| Заміри | `LoadMetrics` | performance API | no-op |

Правило: жодного `dart:html`/`package:web` поза `*_web.dart`; збірки `flutter build web`, `apk --debug`, `ios --simulator` — у кожній задачі, що чіпає `app/`.

## Частини

| # | Що | Результат (перевіряється) | Днів агента |
|---|---|---|---|
| **P1** | Фундамент: репо, сервер (репозиторії, сесії, вхід організатора, група, приєднання за посиланням + PIN), клієнт (роутер, тема «Скло», сесія, realtime), правила Firebase, деплой `candidate` | Організатор створює групу, учасник входить за посиланням на 3 платформах; e2e зелений; ревізія `candidate` без трафіку | 2,5 |
| **P2** | Календар: база завдань (UA), конструктор (авто / вручну / «Інше» / свої), режим «авто щодня», **рулетка** на «Сьогодні» (синхронна анімація), фонові роботи (Scheduler → `/internal/tick`, ідемпотентно) | Завдання відкривається за розкладом; рулетка однакова у двох клієнтах | 2 |
| **P3** | Фото: завантаження, EXIF → час, видалення метаданих, розмите прев'ю, підписані посилання, розкриття о 9:00 через 2 дні, позначка «знято раніше», скарги (мінімум) | Матриця доступу (власне виконання / розкриття / чужа група / не граючий організатор / скарга) покрита тестами | 2 |
| **P4** | Екрани: Сьогодні, Календар, Стрічка (перегляд на весь екран), Рейтинг, Я/Група; аватари (ініціали + колекція) | Віджет-тести станів; integration_test сценарію дня | 2,5 |
| **P5** | Лайки (= голоси), коментарі, журнал балів, швидкість, пізнє виконання, глядацькі симпатії, «лише кількість лайків», дошка рейтингу наживо | Таблиця балів з розділу 9 — тест на кожен рядок | 1,5 |
| **P6** | Сповіщення: дзвіночок і спливні (WebSocket), Telegram-бот у чаті групи, веб-push; Telegram Mini App — вхід | Подія → потрібний канал без дублів; підпис initData перевіряється | 2 |
| **P7** | GA4 + банер згоди, «Видалити мої дані», згода й посилання на політики, перевірки на пристроях, фінальне рев'ю | Чек-лист запуску; фінальне рев'ю (Fable, один прохід) | 1,5 |

Разом ≈ **14 днів агента**. Сьогодні 26.11 → кінець 10–11.12 без запасу на правки після перевірок власника.

## Чи встигаємо до 8–12 грудня

**Повністю — ні з запасом.** У порівнянні з оцінкою дизайну (2–2,5 тижні) додались рулетка у хвилі 1 (2а п. 3) і застосунки з першого дня (2а п. 10, ≈ +15 % на абстракції й збірки). Пропозиція за порядком розділу 14 — перенести у хвилю 2, поки групи грають:
1. **веб-push** (−1 день; лишаються дзвіночок і Telegram-бот),
2. **Telegram Mini App** (−1 день),
3. колекція аватарів (−0,5; лишаються ініціали).

З переносом 1–2 → ≈ 12 днів → готовність ~8.12, старт перших груп **10–12.12**. Рішення — за власником.

## Зі спільних бібліотек

| Береться | Звідки | Статус |
|---|---|---|
| Realtime-клієнт | ks_core v0.6.2 (git-тег) | працює у Chrome, iOS-симуляторі, Android-емуляторі (спайк); Safari — чекає пристрою |
| Realtime-сервер | ks_server v0.3.0 (sync із чистого клону тегу) | працює (спайк) |
| NetworkMonitor, logging (`myPrint`), Telemetry (Analytics), Tutorials, App Check guard (сервер) | ks_core | застосунки — так; **веб — див. нижче** |

## Винести в бібліотеку (задачі бібліотек через хаб; звідси не змінюємо)

1. **ks_core: Crashlytics у вебі.** `Telemetry.install` і `FirebaseCrashSink` викликають `FirebaseCrashlytics`, який у вебі не має реалізації. Потрібно: на вебі — no-op або інший приймач помилок (наприклад, Analytics-подія `app_exception` / Cloud Logging через бекенд). Зачіпає duval, medvibe (лише якщо колись будуть у вебі), commandvibe. Ризик низький: гілка `kIsWeb`. До виходу — commandvibe у вебі **не викликає** `Telemetry.install`, ставить свій `crashSink`.
2. **ks_core: App Check у вебі.** `FirebaseAppCheckTokenSource.activate` не передає `providerWeb` → у вебі токена немає. Потрібно: параметр веб-провайдера (reCAPTCHA Enterprise, ключ сайту від застосунку). До виходу — бекенд commandvibe у `APP_CHECK_MODE=monitor`, і запити з вебу логуються як `missing`.
3. **ks_core: `ForceUpdate.currentPlatform`/`X-App-Platform`** знає лише `android|ios`. Для вебу потрібне `web` (або явне «оновлення не застосовується»). Перевірити першим днем P1; якщо так — задача бібліотеки.
4. **Кандидати на потім** (лише якщо знадобляться іншому проєкту): сесії «без акаунта» (токен доступу + оновлення, хеш у базі) і підписані посилання на файли — ks_server; перевірка підпису Telegram initData — ks_server.

## Тести і деплой

- **Сервер:** jest — юніт на кожен сервіс (in-memory репозиторії), e2e (supertest + `ws`) на кожен ендпоінт і подію; правила доступу до фото — окремий spec з усіма комбінаціями. `npm run sync:realtime:check` у тестах.
- **Клієнт:** юніт-тести view-model (Fake-репозиторії, `FakeRealtimeClient`), віджет-тести станів, `integration_test` на емуляторі/симуляторі. На пристроях власника — лише ручна перевірка, без `flutter test`.
- **Деплой бекенду:** Cloud Run `commandvibe-api`, europe-central2, `--timeout=3600 --concurrency=1000 --min-instances=1 --max-instances=1`; ревізія з тегом `candidate --no-traffic` → перевірки за URL тегу → трафік. Перший запуск — з «так» власника. Секрети — Secret Manager.
- **Веб:** Firebase Hosting сайт `commandvibe-ks` → `commandvibe.karavanstudio.dev`; спершу preview-канал, потім live — з «так» власника.
- **Firestore:** `europe-central2` (рішення 26.11; у розділі 5.1 дизайну ще `europe-west` — оновити в хабі), правила «заборонено все».

## Знахідки, що впливають на план

- **Xcode 27.2 + Flutter 3.41.1:** `lipo -verify_arch` не приймає кілька архітектур → збірка для симулятора падає. Обхід у проєкті: `EXCLUDED_ARCHS[sdk=iphonesimulator*] = x86_64` (Podfile + xcconfig). Оновлення Flutter прибере потребу — перевірити в P1.
- **iOS deployment target ≥ 15.0** (вимога firebase_analytics через ks_core).
- **EXIF:** image_picker у вебі віддає оригінал із EXIF лише без `maxWidth`/`maxHeight` (з ними — перекодування в canvas, EXIF зникає). Отже зменшення до 1600 px — **на сервері** (sharp), не в клієнті; ліміт завантаження 20 МБ. Розділ 7.1 дизайну («клієнт зменшує») — уточнити в хабі.
- **Сторінка запрошення з прев'ю (5.4):** щоб посилання було на `commandvibe.karavanstudio.dev`, пропоную рендерити `/j/<токен>` сервером (Hosting rewrite → Cloud Run) з OG-тегами, а не на sitelanding. Потребує погодження власника.
