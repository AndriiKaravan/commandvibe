# Деплой CommandVibe

## Що вже є

- Firebase-проєкт `commandvibe-ks` (Blaze); Hosting-сайт `commandvibe-ks` → `commandvibe.karavanstudio.dev`.
- Firebase-застосунки: Web, Android `dev.karavanstudio.commandvibe`, iOS `dev.karavanstudio.commandvibe`; клієнтські опції — у `app/lib/core/firebase_options.dart` (не секрет).
- Увімкнені API: Cloud Run, Cloud Build, Artifact Registry.

## Перед першим запуском — рішення власника

1. **Firestore** у `europe-central2` (створення бази незворотне щодо регіону): `firebase firestore:databases:create "(default)" --location=europe-central2 --project commandvibe-ks`, потім `firebase deploy --only firestore:rules,storage --project commandvibe-ks` (правила «заборонено все»).
2. **Секрет** `session-signing-key` (64 випадкові байти, значення ніде не друкувати):
   `openssl rand -base64 64 | tr -d '\n' | gcloud secrets create session-signing-key --project commandvibe-ks --data-file=-`
   і доступ сервісному акаунту Cloud Run: `roles/secretmanager.secretAccessor`.
3. **Перший деплой сервісу**: `FIRST_DEPLOY=1 tool/deploy_api.sh` — створює `commandvibe-api` (europe-central2, `min/max-instances=1`, `--timeout=3600 --concurrency=1000`, App Check `monitor`).

## Контрактні тести Firestore (до першого трафіку)

Репозиторії Firestore перевіряє той самий контрактний набір, що й пам'ять (`server/src/data/repositories.contract.ts`), але лише на емуляторі, якому потрібна Java.
- **Без локальної Java:** GitHub → Actions → `server-firestore-contract` → Run workflow (лише ручний запуск; емулятор з проєктом `demo-commandvibe`, без доступу до справжнього Firebase).
- **Локально з Java 11+:** `tool/firestore_contract.sh`.

## Звичайний цикл

1. `tool/deploy_api.sh` → ревізія `candidate` без трафіку; друкує її URL.
2. Перевірки: `curl <url>/health`; `API=<url> CHANNEL=candidate tool/deploy_web_preview.sh` → preview-канал; наскрізний сценарій (`spike/e2e/run.mjs`-подібний, з посиланням каналу).
3. Трафік на ревізію — після перевірок і з дозволу (CLAUDE.md проєкту): `gcloud run services update-traffic commandvibe-api --to-tags candidate=100 --region europe-central2 --project commandvibe-ks`.
4. Веб на живий сайт — `cd app && flutter build web --release --dart-define=API=https://<api>` і `firebase deploy --only hosting --project commandvibe-ks` — з «так» власника.

## Hosting

`firebase.json`: `/j/**` → Cloud Run `commandvibe-api` (сторінка запрошення з OG-тегами), решта → `index.html`. Вхід Google іде через домен сторінки (`authDomain` = домен Hosting), тож кожен домен додається в OAuth-клієнт як redirect URI `https://<домен>/__/auth/handler` і в Firebase Authorized domains.
