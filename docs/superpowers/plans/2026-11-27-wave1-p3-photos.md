# CommandVibe P3 — фото, розмиття, розкриття, скарги: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Учасник виконує завдання відкритого дня: знімає або обирає фото, клієнт надсилає оригінал. Сервер:
- повертає фото за EXIF, читає час зйомки, зменшує до 1600 px і видаляє всі метадані;
- робить розмите прев'ю і зберігає обидва файли у Storage;
- ставить позначку «знято раніше» для організатора.

Чужі фото дня видно розмитими, доки учасник не виконав завдання або доки не настала 9:00 другого дня після відкриття дня. Зображення віддаються лише за коротким підписаним посиланням. Учасник може поскаржитись, організатор приховує фото. Матриця доступу покрита тестами повністю.

**Architecture:** Новий модуль сервера `photos/`:
- чисті функції: тип файлу, обробка зображення (sharp), час з EXIF, рішення про доступ, підпис посилань;
- репозиторії `submissions` і `complaints` (пам'ять + Firestore, спільний контрактний набір);
- `PhotoStore` (пам'ять + GCS через Admin SDK);
- `PhotosService` і `ModerationService`.

Розкриття — новий крок у `GameEngine.advance`, тож нового cron немає. Доступ щоразу рахує одна функція `decidePhotoAccess` — і при видачі списку, і при віддачі файлу. Клієнт: фіча `photos` (надсилання, смуга фото дня на картці «Сьогодні», перегляд на весь екран, скарги). Повні екрани Стрічки — P4.

**Tech Stack:** як у P2, плюс `sharp@^0.35.5` (libvips, нативний модуль) і `exifr@^7.1.3`. Обидва вже перевірені в спайку 26.11. `firebase-admin/storage` бере `@google-cloud/storage`: це optional-залежність firebase-admin 13, її встановлює `npm ci`.

**Spec:** `docs/specs/2026-11-19-photo-challenge-design.md` — розділи 2а (п. 2, 10, 13), 6 «Організатор», 6а «Сьогодні», «Стрічка», «Хто що бачить», 7, 11, 12, 13, 16. Дорожня карта: рядок P3 і «Знахідки». Спайк: `docs/reports/2026-11-26-day1-spike.md` (знахідки 4 і 7).

## Global Constraints

- **Ліміти розміру.** Клієнт не надсилає файл > **15 МіБ** (15 728 640 байт) і показує «Фото завелике — зніми ще раз або обери менше». Сервер приймає ≤ **20 МіБ** (20 971 520 байт), інакше `413 photo_too_large`. Сервер перевіряє `Content-Length` до читання тіла і рахує байти під час читання.
- **Типи.** Тип визначають магічні байти, а не заголовок:
  - приймаємо JPEG, PNG, WebP;
  - HEIC/HEIF — `415 heic_unsupported`; решта — `415 unsupported_type`;
  - пошкоджений файл або > 60 Мпкс — `422 invalid_image`.
  Причина відмови від HEIC: готовий libvips у sharp не декодує HEVC, а збирати libheif в образі — це патентні й часові ризики. Safari й Chrome у вебі вже віддають JPEG.
- **Що зберігається.** Лише похідні файли, усі JPEG без EXIF/XMP/IPTC/ICC, у sRGB:
  - `photo.jpg` — `rotate()` за EXIF, довга сторона ≤ 1600 без збільшення, q 82;
  - `blur.jpg` — з `photo.jpg`: зменшення до довгої сторони **32 px** → blur σ 1.2 → збільшення до **320 px** (cubic) → blur σ 6 → q 60.
  Сирий оригінал не зберігається ніде, навіть тимчасово у Storage: у ньому GPS (див. «Рішення власника»). Прозорий PNG кладеться на білий фон; з анімованого WebP береться перший кадр.
- **Шляхи у Storage:** `groups/{groupId}/cells/{dd}/{memberId}/{version}/photo.jpg` і `…/blur.jpg`.
  - `dd` — день у 2 цифри, як id клітинки;
  - `version` — 16 hex випадкових символів, нові на кожне надсилання.
  Префікс `groups/{groupId}/` дає видалити групу одним префіксом (P7).
- **Час зйомки.** `takenAt` береться з `DateTimeOriginal` (запасне поле — `CreateDate`), сирим рядком (`reviveValues: false`):
  - якщо є `OffsetTimeOriginal`, час точний;
  - інакше це настінний час у поясі групи;
  - час до 2000-01-01 або пізніше `now + 24 год` — як відсутній.
- **«Знято раніше».** `flags.takenBefore = takenAt !== undefined && takenAt < cell.openedAt`. Без EXIF позначки немає. Це лише позначка для організатора, а не відмова.
- **`source`.** `camera|gallery` з query; інше значення стає `unknown`. Поле зберігається окремо й показується лише організатору як підказка, ніколи не як доказ.
- **Розкриття.** `revealAt(cell) = zonedToUtc(addDays(localDate(cell.opensAt, tz), 2), '09:00', tz)`:
  - береться дата за розкладом (`opensAt`), а не фактичне `openedAt`: «завдання 1-го → 3-го о 9:00» діє і для дня, відкритого пізно;
  - доступ рахується за формулою `now >= revealAt`; `cell.revealedAt` лише прибирає дублі події.
- **Одне виконання на день:** `submissions/{memberId}`. Здати можна, коли клітинка `open`, завдання вже видно гравцям (`taskVisibleToPlayers`) і група не `finished`. Пізнє виконання дозволене до кінця гри; балів у P3 немає.
- **Заміна фото:** `PUT … ?replaces=<version>`, лише до `revealAt` і не для прихованого фото. `submittedAt` лишається першим (для балів P5).
- **Кінець гри зсувається:** `finished`, коли `now >= revealAt(останній день)`, а не `opensAt + 24 год`. Причина: подія `game.finished` іде після розкриття останнього дня, і пізні виконання можливі до кінця. Тест P2 «finished після останнього дня» оновлюється.
- **Посилання на файли:** `GET /p/<token>` на самому API (`@Public()`). Токен — `base64url(claims).base64url(HMAC-SHA256)`:
  - ключ — `hkdfSync('sha256', SESSION_SIGNING_KEY, '', 'commandvibe/photo-url/v1', 32)`, тож новий секрет не потрібен;
  - `claims = {g, d, a (автор), v (версія), x: 'photo'|'blur', k (вид суб'єкта), s (id того, хто дивиться), e}`;
  - `e = floor(now / 300 с) * 300 с + 600 с`: посилання живе 5–10 хв і однакове в межах 5-хвилинного вікна, тож браузер кешує;
  - при віддачі файлу сервер знову викликає `decidePhotoAccess` для `s`;
  - будь-яка невдача — `404` без тіла: так сервер не підказує, чому файлу не дали;
  - заголовки: `Content-Type: image/jpeg`, `Cache-Control: private, max-age=<до e>`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- **Події** — без URL і без вмісту фото:
  - у `group:<id>`: `submission.created|submission.replaced|submission.hidden|submission.restored {dayIndex, memberId}`, `photos.revealed {dayIndex}`;
  - у `org:<id>`: `complaint.created {dayIndex, memberId}`.
- **Навантаження** (один екземпляр, `concurrency=1000`):
  - `uploads` — до 8 тіл одночасно, без черги;
  - `processing` — до 2 обробок sharp одночасно, черга 6;
  - понад ліміт — `503 busy` + `Retry-After: 3`;
  - `sharp.cache(false)`, `limitInputPixels: 60_000_000`, `failOn: 'error'`;
  - Cloud Run `--memory=1Gi --cpu=1`.
- **Пристрої.** Тести клієнта — юніт, віджет і headless Chrome. **Симулятори й емулятори без власника не запускати.** `apk --debug` / `ios --simulator` — дозволені.
- **Спільні бібліотеки** не змінюються. Підписані посилання — кандидат у ks_server на потім (дорожня карта, «Винести», п. 4); тут — власний код.

## Матриця доступу (одне джерело правди — `decidePhotoAccess`)

Позначення: **повне** — `photo.jpg`; **розмите** — `blur.jpg`; **дані** — автор і час здачі; **модерація** — `takenBefore`, `takenAt`, `source`, кількість скарг; **скарги** — список зі скаржниками.

| Хто дивиться \ стан | до розкриття, не здав | до розкриття, здав (видиме фото) | після розкриття | приховане фото | автор вилучений |
|---|---|---|---|---|---|
| Автор (своє фото) | повне + статус | повне + статус | повне + статус | повне + «приховано» | — |
| Активний учасник | розмите + дані | повне + дані | повне + дані | не в списку | не в списку |
| Організатор, що грає | розмите* + модерація | повне + модерація | повне + модерація | у списку, зображення за тими самими правилами* + модерація | у списку з модерацією |
| Організатор, що не грає | розмите* + модерація | — | повне + модерація | як вище* | як вище |
| Учасник `pending` / `removed` | `403` | `403` | `403` | `403` | `403` |
| Учасник іншої групи | `403` | `403` | `403` | `403` | `403` |
| Без входу | `401` (список), `404` (`/p/`) | | | | |

`*` — **повне, якщо на фото є відкрита скарга** (дизайн 6: організатор бачить його одразу, щоб розглянути). Приховування саме по собі повного доступу не дає, інакше «приховав → подивився → повернув» обходить розмиття. Список скарг бачить лише власник групи. Власне приховане фото не відкриває чужих: відхилене фото не є виконанням.

## Review Focus

- **Фото 19,9 МБ і 20 МБ + 1 байт; 15 МБ + 1 на клієнті.** Перше обробляється (`201`); друге дає `413` ще до повного читання тіла, без OOM; клієнт третє не надсилає. Тести — Task 1, 5, 8.
- **Портрет з EXIF Orientation = 6 (типовий iPhone/Samsung).** Збережений файл має портретні розміри, верх кадру там, де був на фото, і в ньому немає тегу Orientation (інакше переглядач поверне ще раз). Тест — Task 1.
- **Фото з GPS і серійним номером камери.** Ні `photo.jpg`, ні `blur.jpg`, ні відповідь API не містять жодного байта EXIF/XMP/GPS; сирий файл ніде не лишається. Тест — Task 1 і Task 5.
- **Учасник надсилає двічі паралельно (подвійний дотик, повтор після обриву).** Один `201`, другий `409 already_submitted {version}`. Документ один, у Storage немає сиріт. Тест — Task 2 (контракт) і Task 5.
- **Посилання витекло:**
  - після приховування, вилучення автора чи глядача або заміни фото — `404` одразу, навіть у межах `e`;
  - після `e` — `404`;
  - підроблений підпис чи чужий `s` — `404`.
  Тест — Task 4 і Task 7.

---

### Task 1: Обробка зображення — тип, sharp, EXIF-час

**Files:**
- Create: `server/src/photos/image-type.ts`, `server/src/photos/image-pipeline.ts`, `server/src/photos/exif-time.ts`, specs поруч, `server/src/photos/testing/fixture-images.ts`
- Modify: `server/package.json` (`sharp`, `exifr`), `server/Dockerfile`

**Interfaces:**
- Produces:
  - `type ImageType = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown'`; `sniffImageType(bytes: Buffer): ImageType`:
    - JPEG — `FF D8 FF`;
    - PNG — `89 50 4E 47`;
    - WebP — `RIFF....WEBP`;
    - HEIC — `ftyp` + `heic|heix|hevc|mif1|msf1|heif`.
  - `class PhotoRejected extends Error { code: 'unsupported_type' | 'heic_unsupported' | 'invalid_image' }`
  - `interface ExifTime { wall: string /* YYYY-MM-DD HH:mm:ss */; offset?: string /* ±HH:mm */ }`
  - `processPhoto(bytes: Buffer): Promise<ProcessedPhoto>`, де `ProcessedPhoto = { photo: Buffer; blur: Buffer; width: number; height: number; exifTime?: ExifTime }`
  - `takenAtOf(exif: ExifTime | undefined, timeZone: string, now: Date): Date | undefined` (через `zonedToUtc` + секунди)
  - фікстури (генеруються sharp у тесті, бінарних файлів у репо немає): `jpeg({width, height, orientation?, dateTimeOriginal?, offset?, gps?: true, make?})`, `png({alpha: true})`, `checkerboard(1600, 1200, 8)`, `heicHeader()`, `padTo(buffer, bytes)` (дописує нулі після EOI).

- [ ] Тести (RED):
  - `sniffImageType` для кожного типу; текст `"hello"` дає `unknown`;
  - **GPS:** JPEG 4000×3000 з GPS, `Make`, `DateTimeOriginal` → `photo` 1600×1200; `sharp(photo).metadata()` без `exif`, `xmp`, `iptc`, `icc`; те саме для `blur`; байтів `GPS` і назви камери немає в жодному буфері;
  - **поворот:** 400×200, ліва половина червона, `orientation: 6` → `photo` 200×400, піксель (100, 20) червоний, `metadata().orientation` відсутній;
  - 800×600 не збільшується;
  - PNG з альфою → JPEG, прозорі пікселі білі;
  - **розмиття:** `blur` має довгу сторону 320 і ≤ 8 КБ; для `checkerboard` `sharp(blur).stats()` дає `stdev < 4` у кожному каналі (дрібний візерунок не відновлюється);
  - HEIC → `PhotoRejected('heic_unsupported')`; обрізаний JPEG і 9000×8000 → `invalid_image`;
  - `padTo(jpeg, 20 971 519)` обробляється (дані після EOI ігноруються);
  - `takenAtOf`:
    - `{wall:'2026-12-01 08:59:00'}` у Kyiv дає `2026-12-01T06:59:00Z`;
    - з `offset:'+01:00'` — `07:59Z`;
    - `1999-…` і `now + 2 доби` дають `undefined`.
- [ ] Реалізація (`exifr.parse(bytes, {pick: ['DateTimeOriginal','OffsetTimeOriginal','CreateDate'], reviveValues: false})`; помилка exifr означає «без часу», а не відмову).
- [ ] Dockerfile: після `npm ci` у стадії збірки — `RUN node -e "require('sharp')"`, щоб збірка впала одразу, якщо лок-файл з macOS не містить `@img/sharp-linux-x64`. Якщо впаде — `npm install --os=linux --cpu=x64 sharp` і закомітити лок. `node:22-slim` (glibc) лишається.
- [ ] `npx jest src/photos` → PASS. `docker build server` локально, якщо Docker є (інакше — перевірка в Cloud Build у Task 10). Коміт.

### Task 2: Моделі, репозиторії `submissions` і `complaints`, час розкриття

**Files:**
- Modify: `server/src/data/models.ts`, `repositories.ts`, `repositories.contract.ts`, `memory/memory-repositories.ts`, `firestore/firestore-repositories.ts`, `data.module.ts`, `server/src/game/game-time.ts` (+ spec)

**Interfaces:**
- Produces:
  - `UploadSource = 'camera' | 'gallery' | 'unknown'`
  - `Submission { groupId; dayIndex; memberId; version; photoPath; blurPath; width; height; submittedAt: Date; updatedAt: Date; takenAt?: Date; source: UploadSource; flags: { takenBefore: boolean }; status: 'visible' | 'hidden'; hiddenAt?: Date }`
  - `SubmissionRepository`:
    - `get(groupId, dayIndex, memberId)`;
    - `listDay(groupId, dayIndex)`;
    - `listMember(groupId, memberId, days: number)`;
    - `put(submission, expectedVersion: string | null): Promise<'created' | 'replaced' | 'conflict'>` — транзакція: `null` — лише створення; рядок — заміна лише при тій самій версії;
    - `setStatus(groupId, dayIndex, memberId, status, at): Promise<boolean>`;
    - `delete(groupId, dayIndex, memberId): Promise<void>`.
  - `ComplaintReason = 'inappropriate' | 'not_task' | 'other'`
  - `Complaint { id /* `${dd}_${author}_${complainer}` */; groupId; dayIndex; authorMemberId; complainerMemberId; reason; status: 'open' | 'resolved'; createdAt; resolvedAt? }`
  - `ComplaintRepository`:
    - `add(c): Promise<boolean>` — false, якщо така скарга вже є;
    - `listOpen(groupId)`;
    - `openCount(groupId, dayIndex, authorMemberId)`;
    - `resolve(groupId, dayIndex, authorMemberId, at): Promise<number>`;
    - `deleteInvolving(groupId, memberId)`.
  - `Cell.revealedAt?: Date`; `CellRepository.markRevealed(groupId, dayIndex, at): Promise<boolean>` — CAS «поки `revealedAt` порожнє».
  - `revealAt(opensAt: Date, timeZone: string): Date` у `game-time.ts`.
  - Токени `SUBMISSIONS`, `COMPLAINTS`.
- Firestore: `groups/{g}/cells/{dd}/submissions/{memberId}`, `groups/{g}/complaints/{id}`. Запити — `listDay` (колекція дня), `listOpen` (`where status == 'open'`, автоматичний одно-польовий індекс). `listMember` — `getAll` по днях `0..days-1`. Нових складених індексів немає.

- [ ] Тести (RED):
  - `revealAt`:
    - `2026-12-01T07:00Z` (Kyiv) дає `2026-12-03T07:00Z`;
    - відкриття `2027-03-26T07:00Z` дає `2027-03-28T06:00Z` (літній час);
    - `2026-10-23T06:00Z` дає `2026-10-25T07:00Z` (зимовий);
    - `opensAt` `2026-12-01T22:30Z` (у Kyiv вже 02.12) дає `2026-12-04T07:00Z`.
  - Контракт (пам'ять і Firestore):
    - `should create a submission once when two creates race` (10 паралельних `put(…, null)` дають рівно один `created`);
    - `should replace only when the expected version matches`;
    - `should round-trip dates, flags and an absent takenAt`;
    - `should list a day and a member's submissions`;
    - `should count one complaint per complainer and photo`;
    - `should resolve open complaints of one photo only`;
    - `should delete complaints filed by or against a member`;
    - `should mark a day revealed once under concurrency`.
- [ ] Реалізація. `npx jest src/data src/game/game-time` → PASS; Firestore-частина — через `tool/firestore_contract.sh` або workflow (Task 3 розширює обидва). Коміт.

### Task 3: `PhotoStore` — пам'ять і GCS, контракт на емуляторі Storage

**Files:**
- Create: `server/src/photos/photo-store.ts` (інтерфейс, `MemoryPhotoStore`, `photoPaths`), `server/src/photos/gcs-photo-store.ts`, `server/src/photos/photo-store.contract.ts`, `photo-store.memory.spec.ts`, `photo-store.gcs.spec.ts`
- Modify: `server/src/data/data.module.ts` (провайдер `PHOTO_STORE`: `memory` → `MemoryPhotoStore`; `firestore` → `GcsPhotoStore(getStorage(app).bucket(PHOTOS_BUCKET))`; без `PHOTOS_BUCKET` поза memory сервер не стартує), `firebase.json` (`emulators.storage.port: 9199`), `tool/firestore_contract.sh` і `.github/workflows/server-firestore-contract.yml` (`--only firestore,storage`, `npx jest src/data src/photos/photo-store`)

**Interfaces:**
- Produces:
  - `PhotoStore`:
    - `put(path, bytes, contentType): Promise<void>` — GCS: `resumable: false`, `cacheControl: 'no-store'`;
    - `get(path): Promise<Buffer | undefined>`;
    - `delete(paths: string[]): Promise<void>` — відсутній файл не помилка;
    - `deletePrefix(prefix): Promise<number>`.
  - `photoPaths(groupId, dayIndex, memberId, version) → { photo, blur, prefix }`, де `prefix = groups/{g}/cells/{dd}/{m}/`.

- [ ] Контрактні тести (RED): put/get байт у байт; get неіснуючого дає `undefined`; `deletePrefix` видаляє лише свій префікс (сусідній учасник і сусідня група лишаються) і повертає кількість. GCS-набір запускається лише з `FIREBASE_STORAGE_EMULATOR_HOST` (як `firestore.spec.ts`), бакет `demo-commandvibe.appspot.com`.
- [ ] Реалізація. `npx jest src/photos` → PASS (GCS — `skip` без емулятора). Коміт.

### Task 4: Рішення про доступ і підписані посилання

**Files:**
- Create: `server/src/photos/photo-access.ts`, `photo-access.spec.ts`, `server/src/photos/photo-url.ts`, `photo-url.spec.ts`

**Interfaces:**
- Produces:
  - `ViewerRelation = 'outsider' | 'pending' | 'removed' | 'member' | 'owner'`
  - `PhotoViewer { relation; memberId?: string /* і в організатора, що грає */; ownVisibleSubmission: boolean }`
  - `PhotoSubject { authorMemberId; authorActive: boolean; hidden: boolean; openComplaints: number }`
  - `PhotoAccess { listed: boolean; image: 'full' | 'blur' | 'none'; moderation: boolean }`
  - `decidePhotoAccess(viewer, photo, revealed: boolean): PhotoAccess` — таблиця вище, дослівно.
  - `PhotoUrlClaims { g; d; a; v; x: 'photo' | 'blur'; k: SubjectKind; s }`
  - `PhotoUrlSigner(key: Buffer)`:
    - `sign(claims, now): string` повертає `/p/<token>`;
    - `verify(token, now): PhotoUrlClaims | undefined`;
    - `expiresAt(now): Date`.

- [ ] Тести (RED):
  - `photo-access.spec.ts` — **`it.each` по всіх комбінаціях**: `relation` (5) × `isAuthor` × `ownVisibleSubmission` × `revealed` × `hidden` × `openComplaints` (0 | 1) × `authorActive`. Очікування задає окрема таблиця в тесті, переписана з матриці плану, а не викликом тієї ж функції.
  - Обов'язкові іменовані рядки:
    - `should blur another's photo for a member who has not submitted before reveal`;
    - `should show it in full after own submission`;
    - `should not count an own hidden submission`;
    - `should show it in full to everyone in the group after reveal`;
    - `should blur it for an owner who does not play, until a complaint is open`;
    - `should not unblur a photo for the owner just because it is hidden`;
    - `should give moderation data to the owner only`;
    - `should not list hidden photos or photos of removed authors to members`;
    - `should deny pending, removed and outsider viewers everything`.
  - `photo-url.spec.ts`:
    - підпис дає `verify` тих самих claims;
    - змінений будь-який байт дає `undefined`;
    - `e` у минулому дає `undefined`;
    - у межах одного 5-хв вікна `sign` повертає той самий рядок;
    - життя посилання — від 300 до 600 с;
    - ключ з HKDF відрізняється від `SESSION_SIGNING_KEY`: токен, підписаний сирим ключем, не проходить.
- [ ] Реалізація. Тести → PASS. Коміт.

### Task 5: Надсилання, список дня, віддача файлів

**Files:**
- Create: `server/src/photos/upload-gate.ts` (+ spec), `photos.service.ts` (+ spec), `photos.controller.ts`, `photo-file.controller.ts`, `photo-events.ts`, `views.ts`, `photos.module.ts`, `server/test/photos.e2e-spec.ts`
- Modify: `server/src/app.module.ts`, `server/test/test-app.ts` (опція `clock?: { now: Date }` — змінний `CLOCK`), `server/src/main.ts` (CORS `allowedHeaders` + `content-length`; `exposedHeaders: ['retry-after']`)

**Interfaces:**
- Consumes: Task 1–4; `GroupsService.getFor`, `taskVisibleToPlayers`, `revealAt`, `RealtimeService`, `groupTopic`/`ownerTopic`.
- Produces:
  - `Semaphore(max, maxWaiting).run(fn)`, при переповненні кидає `ServiceUnavailableException('busy')`; контролер ставить `Retry-After: 3`.
  - REST (помилки — `message` = код, як у P2):
    - `POST /groups/:id/days/:day/submission?source=camera|gallery` — тіло: сирі байти, `Content-Type: image/*` або `application/octet-stream`; інакше `415 unsupported_type`. Відповідь `201 SubmissionView`.
    - `PUT /groups/:id/days/:day/submission?source=&replaces=<version>` → `200 SubmissionView`.
    - Помилки обох:
      - `413 photo_too_large`, `415 heic_unsupported|unsupported_type`, `422 invalid_image`;
      - `403 not_playing` (організатор без запису учасника);
      - `409 day_not_open` (закрита клітинка, крутиться рулетка або задача ще прихована);
      - `409 game_finished`;
      - `409 already_submitted {version}` (POST при наявному);
      - `409 version_mismatch` (PUT з чужою версією або без наявного);
      - `409 reveal_passed`, `409 photo_hidden` (лише PUT);
      - `503 busy`.
    - `GET /groups/:id/days/:day/submissions` → `DaySubmissionsView`.
    - `GET /p/:token` (`@Public()`) → JPEG або `404`.
  - `SubmissionView { memberId; displayName; submittedAt; access: 'full' | 'blur'; photoUrl?; blurUrl; width; height; mine: boolean; version?; status?; moderation?: { takenBefore; takenAt?; source; openComplaints } }`:
    - `version` і `status` — лише автору;
    - `moderation` і `status` — власнику групи;
    - `photoUrl` — лише при `full`.
  - `DaySubmissionsView { dayIndex; revealAt; revealed; canSubmit; mine?: SubmissionView; items: SubmissionView[] /* без mine, за submittedAt */; total: number /* видимі виконання */; serverTime }`.
  - Порядок `submit`:
    1. Перевірки доступу й дня.
    2. Читання тіла (gate `uploads`).
    3. `processPhoto` (gate `processing`).
    4. `takenAtOf`, `takenBefore`.
    5. `store.put` ×2 з новою версією.
    6. `submissions.put(…, replaces ?? null)`: при `conflict` — видалити щойно записане і `409`; при заміні — видалити файли старої версії (помилку лише залогувати).
    7. Подія `submission.created` або `submission.replaced`.
  - Тіло читається з `@Req()` потоком: JSON-парсер Nest не чіпає `image/*`.

- [ ] Тести сервісу й e2e (RED):
  - **ліміти:** 19,9 МБ → `201`; `Content-Length` 20 МБ + 1 → `413` без читання; тіло без `Content-Length` понад ліміт (chunked) → `413`, з'єднання закрито;
  - HEIC → `415 heic_unsupported`; `application/json` → `415`;
  - **паралельні POST двох фото від одного учасника → `201` і `409 already_submitted`**, у `MemoryPhotoStore` рівно 2 файли;
  - PUT з правильною версією → `200`, старі файли видалено, `submittedAt` той самий; після `revealAt` → `409 reveal_passed`;
  - `takenBefore`:
    - EXIF за хвилину до `openedAt` → `true`;
    - через хвилину після → `false`;
    - без EXIF → `false`, `takenAt` відсутній;
    - `source=selfie` → `unknown`;
  - **відповідь і список не містять GPS, `takenAt`, `source` для не-власника** (перевірка JSON на ключі);
  - день `closed`, рулетка `picking`, `finished` → свої `409`; організатор, що не грає → `403 not_playing`;
  - `/p/`:
    - чинне посилання → JPEG і заголовки з Global Constraints, а для дозволеного `Origin` — `Access-Control-Allow-Origin` (CanvasKit вантажить зображення через `fetch`);
    - через 11 хв (змінний clock) → `404`;
    - підроблене → `404`;
    - `blur` чужого фото до розкриття → `200`;
    - `photo` того самого → `404`, навіть із правильно підписаним `x: 'photo'`, бо доступ перевіряється наново;
  - **ws:** B підписаний на `group:<id>`; A надсилає → B отримує `submission.created {dayIndex, memberId}`, і в кадрі немає `url`, `photo`, `blur`;
  - `Semaphore`: 3-тя обробка при `max=2, maxWaiting=0` → `busy`.
- [ ] Реалізація. `npx jest src/photos && npx jest --config ./test/jest-e2e.json photos` → PASS. Коміт.

### Task 6: Розкриття о 9:00 — двигун гри і tick

**Files:**
- Modify: `server/src/game/game-engine.ts` (+ spec), `server/src/game/views.ts` (`DayView.revealAt?` для відкритих днів), `server/test/tick.e2e-spec.ts`, `server/test/today.e2e-spec.ts`

**Interfaces:**
- Produces:
  - у `advance` після відкриттів: для кожної `open`-клітинки з `revealAt <= now` і без `revealedAt` — `markRevealed`; виграв — `photos.revealed {dayIndex}`;
  - `finishIfOver`: `now >= revealAt(last.opensAt)`.
  - `/internal/tick` не змінюється: розкриття приходить разом з `advance`.

- [ ] Тести (RED):
  - день 01.12 о 09:00 Kyiv: о 03.12 08:59 подій немає, о 09:00 — рівно одна `photos.revealed`;
  - **два `advance` паралельно → одна подія**;
  - пропущено 3 дні без tick → кожен день розкривається один раз, по порядку;
  - `finished` лише після розкриття останнього дня;
  - `GET today` / `calendar` дають `revealAt` відкритого дня;
  - e2e tick: повторний виклик не шле нових подій;
  - **доступ не чекає tick:** без жодного `advance` о 09:01 `GET submissions` уже віддає `full`.
- [ ] Реалізація. `npx jest src/game && npx jest --config ./test/jest-e2e.json` → PASS. Коміт.

### Task 7: Скарги, приховування, вилучення учасника

**Files:**
- Create: `server/src/photos/moderation.service.ts` (+ spec), `server/test/moderation.e2e-spec.ts`
- Modify: `server/src/photos/photos.controller.ts`, `photos.service.ts` (`deleteMemberData`), `server/src/members/members.service.ts` (`remove` викликає `deleteMemberData` після зміни статусу), `members.module.ts` (імпорт `PhotosModule`)

**Interfaces:**
- Produces (REST):
  - `POST /groups/:id/days/:day/submissions/:memberId/complaints` `{reason?: ComplaintReason}` (за замовчуванням `other`) → `204`:
    - повторна скарга — теж `204`, без дубля;
    - `404 no_submission`; `422 own_photo`;
    - `403 not_visible` — скаржитись можна лише на фото, яке видно повністю.
    Подія `complaint.created` у `org:<id>`.
  - `GET /groups/:id/complaints` (власник) → `{items: ComplaintView[]}`, де `ComplaintView { dayIndex; memberId; displayName; reasons: Record<ComplaintReason, number>; complainers: {memberId, displayName}[]; firstAt; hidden }`, лише з відкритими скаргами.
  - `PUT /groups/:id/days/:day/submissions/:memberId/hidden` `{hidden: boolean}` (власник) → `204`:
    - приховування закриває відкриті скарги;
    - повернення — без нових скарг;
    - події `submission.hidden` / `submission.restored`.
  - `POST …/:memberId/complaints/dismiss` (власник) → `204`, закриває скарги без приховування.
  - `PhotosService.deleteMemberData(groupId, memberId): Promise<void>` видаляє:
    - документи `submissions` учасника;
    - файли за `prefix` кожного дня;
    - скарги, які він подав, і скарги на нього.
    Повторний виклик — без помилок. Для P7 («Видалити мої дані», видалення групи — `deletePrefix('groups/{g}/')`) лишається лише ендпоінт.
- Свідомо поза P3:
  - скарги на коментарі (P5);
  - автоприховування за кількістю скарг;
  - сповіщення автору;
  - блокування між учасниками;
  - журнал модерації.

- [ ] Тести (RED):
  - скарга на розмите фото → `403`, на своє → `422`;
  - дві скарги від одного → одна в списку;
  - організатор, що не грає: до скарги в списку `access: 'blur'`, після — `full`, і `/p/` для `photo` тепер `200`;
  - приховане зникає з `items` у учасників, автор бачить `status: 'hidden'`;
  - **виданий раніше `photoUrl` після приховування → `404`**; після повернення нове посилання знову `200`;
  - учасник не бачить `GET complaints` (`403`) і поля `complainers`;
  - **вилучення:** документи й файли автора зникли, `GET submissions` у інших без нього, посилання на його фото → `404`; посилання, видане вилученому глядачу, → `404`.
- [ ] Реалізація. Тести → PASS. Коміт.

### Task 8: Клієнт — дані й надсилання

**Files:**
- Create: `app/lib/features/photos/data/photos_repository.dart`, `photos_models.dart`, `photo_type.dart`, `app/lib/features/photos/ui/submit_view_model.dart`, `app/test/features/photos/fake_photos_repository.dart`, `submit_view_model_test.dart`, `photos_models_test.dart`, `photo_type_test.dart`
- Modify: `app/lib/core/api/api_client.dart` (+ `api_client_test.dart`), `app/lib/core/services_scope.dart` (`photosRepository`)

**Interfaces:**
- Produces:
  - `ApiClient.upload(String method, String path, Uint8List bytes, {required String contentType}) -> Future<Object?>` — той самий refresh-на-`401`, без JSON-тіла; `ApiException.details['version']` для `409 already_submitted`.
  - `enum PhotoType { jpeg, png, webp, heic, unknown }`, `sniffPhotoType(Uint8List)` — ті самі сигнатури, що на сервері.
  - `PhotosRepository`:
    - `day(groupId, dayIndex) -> DaySubmissions`;
    - `submit(groupId, dayIndex, PickedPhoto photo, {String? replaces}) -> SubmissionItem` (`source` = `photo.origin.name`);
    - `complain(groupId, dayIndex, memberId, ComplaintReason)`;
    - `complaints(groupId) -> List<ComplaintItem>`;
    - `setHidden(groupId, dayIndex, memberId, bool hidden)`;
    - `dismiss(groupId, dayIndex, memberId)`.
  - Моделі `DaySubmissions`, `SubmissionItem` (`PhotoAccess access`, `Uri? photoUrl`, `Uri blurUrl` — відносні URL резолвляться від `ApiClient.baseUri`), `Moderation`, `ComplaintItem`.
  - `SubmitViewModel(repository, photoSource, {groupId, dayIndex, retryDelay})`:
    - стани: `SubmitIdle`, `SubmitUploading`, `SubmitConfirmReplace(version)`, `SubmitDone(item)`, `SubmitFailed(SubmitError)`;
    - `SubmitError { tooLarge, heicUnsupported, unsupportedType, invalidImage, dayClosed, revealPassed, photoHidden, network, failed }`;
    - `static const maxUploadBytes = 15 * 1024 * 1024`;
    - методи `pick(PhotoOrigin)`, `confirmReplace()`, `retry()` (повтор з тими самими байтами в пам'яті).

- [ ] Тести (RED):
  - **15 МіБ + 1 → `tooLarge`, `submit` не викликано; рівно 15 МіБ → надсилається**;
  - HEIC за магічними байтами → `heicUnsupported` без надсилання;
  - скасований вибір → `SubmitIdle`;
  - `409 already_submitted {version}` → `SubmitConfirmReplace`; `confirmReplace` → `submit(replaces: version)`;
  - **`503` → автоповтор через `retryDelay` до 3 разів, потім `failed`**;
  - `NetworkException` → `network`, `retry()` надсилає ті самі байти;
  - `upload` додає `authorization`, `content-type: image/jpeg`, після `401 token_invalid` оновлює токен і повторює;
  - моделі: `photoUrl` відсутній при `blur`.
  - Відсоток завантаження не показуємо: `http` у вебі не дає прогресу відправлення (потрібен XHR у `*_web.dart`). Стан `SubmitUploading` — «Надсилаємо…» з неперервним індикатором.
- [ ] `app/tool/check.sh` → усе `ok`. Коміт.

### Task 9: Клієнт — «Виконати», смуга фото дня, перегляд, скарги

**Files:**
- Create:
  - `app/lib/features/photos/ui/submit_sheet.dart`, `day_photos_view_model.dart`, `day_photos_strip.dart`, `blurred_photo_tile.dart`, `photo_viewer_view.dart`, `complaints_view.dart`, `complaints_view_model.dart`
  - тести `app/test/features/photos/*`
  - `tool/fixtures/e2e-photo.jpg` (≈ 20 КБ, згенерований фікстурою Task 1, без EXIF)
- Modify: `app/lib/features/today/ui/today_card.dart` (кнопка «Виконати» / «Виконано ✓» + «Замінити фото» до розкриття; під карткою `DayPhotosStrip`), `app/lib/features/groups/ui/group_home_view.dart` (організатору — «Скарги (N)»), `app/lib/core/router.dart` (`/g/:groupId/photo/:day/:memberId`, `/g/:groupId/complaints`), l10n `app_uk.arb` / `app_en.arb`, `tool/e2e_web.mjs`

**Interfaces:**
- Consumes: Task 5–8; події `submission.*`, `photos.revealed` у `group:<id>`, `complaint.created` у `org:<id>`.
- Produces:
  - `DayPhotosViewModel(repository, realtime, {groupId, dayIndex})`:
    - перечитує список на кожну подію й resync;
    - `imageFailed()` перечитує список не частіше ніж раз на 30 с, щоб отримати свіжі посилання.
  - `DayPhotosStrip` — горизонтальний `ListView.builder`: спершу моє фото, далі інші; `Image.network` з `errorBuilder` → `imageFailed`.
  - `BlurredPhotoTile` — `blurUrl` + напис поверх (дизайн 7.5): «Виконай завдання — і побач одразу» і «або відкриється {d MMMM} о 9:00» за `revealAt` у поясі групи. Після розкриття, якщо не здав, — рядок «Ще можна виконати — до кінця челенджу».
  - `PhotoViewerView` — одне фото на весь екран:
    - учаснику — «Поскаржитись» (лист з 3 причинами);
    - власнику — позначки «Знято раніше, ніж відкрито завдання» і «камера / галерея (підказка)», кнопки «Приховати / Повернути» і «Відхилити скаргу».
    Гортання між фото, коментарі й лайки — P4/P5.
  - Тексти помилок `SubmitError` (UA):
    - `tooLarge` — «Фото завелике — зніми ще раз або обери менше»;
    - `heicUnsupported` — «Формат HEIC поки не підтримується — зніми фото камерою або обери інше»;
    - `invalidImage` / `unsupportedType` — «Не вдалося прочитати фото — обери інше»;
    - `revealPassed` — «Фото цього дня вже відкрились — замінити не можна»;
    - `network` — «Не вдалося надіслати — перевір з'єднання і спробуй ще раз»;
    - підтвердження заміни — «Замінити фото? Попереднє зникне».

- [ ] Тести (RED):
  - view-model: подія `photos.revealed` → перечитування, плитки стають `full`; `imageFailed` двічі за 30 с → одне перечитування;
  - віджет: розмита плитка з датою `3 грудня о 9:00`; «Виконати» лише при `canSubmit` і без `mine`; організатор бачить позначку `takenBefore`, учасник — ні; `SubmitFailed(tooLarge)` показує точний текст.
- [ ] `tool/e2e_web.mjs` — новий крок:
  1. Учасник A в першому контексті: «Виконати» → «Галерея» → `page.waitForFileChooser()` → `accept(['tool/fixtures/e2e-photo.jpg'])` → «Виконано».
  2. Учасник B у другому контексті бачить «Виконай завдання — і побач одразу».
  3. B надсилає фото через API (`POST …/submission` з його токеном) → у B плитка A стає повною (немає напису).
- [ ] `app/tool/check.sh` → усе `ok`; `node tool/e2e_web.mjs` → PASS. Коміт.

### Task 10: Деплой, документація, звіт, рев'ю

**Files:**
- Modify: `tool/deploy_api.sh` (`--memory=1Gi --cpu=1`, `PHOTOS_BUCKET=commandvibe-ks-photos` у `--set-env-vars`), `docs/deploy.md`, `.agents/rules/project-overview.md` (→ 2.7)
- Create: `report/report_YYYYMMDD_HHMM.md`

- [ ] `docs/deploy.md`, розділ «Сховище фото (кроки власника, один раз)». Чи є бакет у `commandvibe-ks`, з репо не видно (у `firebase.json` лише правила), тому окремий бакет створюється так:
  ```
  gcloud storage buckets create gs://commandvibe-ks-photos --project commandvibe-ks \
    --location europe-central2 --uniform-bucket-level-access --public-access-prevention \
    --soft-delete-duration=0
  sa=$(gcloud run services describe commandvibe-api --project commandvibe-ks --region europe-central2 \
    --format='value(spec.template.spec.serviceAccountName)'); sa=${sa:-889388170734-compute@developer.gserviceaccount.com}
  gcloud storage buckets add-iam-policy-binding gs://commandvibe-ks-photos \
    --member "serviceAccount:$sa" --role roles/storage.objectUser
  ```
  - `--soft-delete-duration=0` — інакше GCS тримає видалені фото ще 7 днів, всупереч обіцянці видалення (анти-ціль 3);
  - роль — лише на бакет, не на проєкт;
  - правила `storage.rules` («заборонено все») лишаються для типового бакета Firebase, якщо його колись створять.
- [ ] Порядок викатки:
  1. Власник: бакет і IAM.
  2. `tool/deploy_api.sh` → `candidate` без трафіку.
  3. Workflow `server-firestore-contract` (Firestore + Storage) зелений.
  4. На URL `candidate`: `/health`; тестова група → `POST submission` з фото з GPS → завантажити `/p/` і перевірити `exiftool`/`sharp` — метаданих немає.
  5. Трафік.
  6. Веб — з «так» власника.
- [ ] `project-overview.md`: модуль `photos/`, API, моделі `submissions`/`complaints`/`Cell.revealedAt`, події, `/p/`, нове правило `finished`.
- [ ] Звіт: повний текст задачі; виконане; запит синхронізації — REST `GET …/submissions` після кожної події `submission.*`/`photos.revealed` і після resync.
- [ ] Фінальне рев'ю гілки — окремий агент на Opus з Review Focus і матрицею. Критичні й важливі зауваження виправляються одним проходом. Перевірки доступу до фото потрапляють і в єдине фінальне рев'ю перед запуском (дизайн 16, Fable, один прохід — P7).
- [ ] Злиття й деплой — за постійним дозволом хабу. Рядок хабу.

## Рішення власника (приватність фото)

Кожен пункт — питання, типове рішення (план виконується з ним) і що зміниться, якщо обрати інакше.

1. **Чи зберігати сирий оригінал?** Типово — **ні**: лише 1600 px без метаданих і розмите прев'ю. Якщо зберігати — третій файл `original` з GPS у Storage і окремий строк його видалення. Тоді P7 має видаляти і його, а ризик витоку геолокації зростає.
2. **Скільки зберігаються фото?** Типово — до видалення групи: 30 днів після кінця гри (дизайн 11, P7). Інакше — коротший строк у задачі видалення P7; на P3 не впливає.
3. **Скільки живе посилання на фото?** Типово — **5–10 хв**, і файл віддає сам сервер, який щоразу перевіряє доступ. Довше посилання — менше перезавантажень, але довше живе витік. Підписані посилання GCS напряму розвантажили б сервер, але їх не відкликати до кінця строку. Також для них потрібні `signBlob` IAM і CORS бакета.
4. **HEIC.** Типово — **відмова з поясненням** (`heic_unsupported`). У вебі iPhone/Safari сам віддає JPEG. Ризик — застосунки Android/iOS з галереї. Підтримка HEIC = власна збірка libvips з libheif в образі (+ ~1 день і патентне питання HEVC).
5. **Чи бачить організатор фото до розкриття?** Типово — **як у дизайні 6 (погоджено 20.11):** організатор, що не грає, бачить розмите до розкриття, повне — лише фото зі скаргою. У постановці P3 сказано «організатор бачить усе в групі» — це суперечить дизайну. Якщо обрати «усе одразу», у `decidePhotoAccess` рядок `owner` → завжди `full`, змінюються 6 рядків матриці. Ризик — анти-ціль «стеження».
6. **Чи можна замінити фото?** Типово — **так, до розкриття дня**; бали рахуються за першим надсиланням. Інакше — лише `POST`, `PUT` прибирається, а помилкове фото лишається до приховування організатором.
7. **Скарги.** Типово — лише організатор приховує (можна повернути) або відхиляє; без автоприховування і без сповіщення автору. Альтернатива — автоприховування після N скарг (`N = ⌈20 % групи⌉`). Ціна — ризик цькування (чужі скарги ховають фото невинного).
8. **Вилучення учасника.** Типово — **фото, скарги й файли видаляються одразу** при вилученні: вилучений уже не зайде, щоб видалити їх сам. Альтернатива — лише сховати від групи до видалення групи. Тоді в `remove` замість `deleteMemberData` — фільтр `authorActive`, він уже є в матриці.
9. **«Знято раніше» і `source`.** Типово — бачить лише організатор, автор — ні. Якщо показати автору, з'являється поле `moderation` у його `SubmissionView` (`takenBefore` без `source`).
10. **Діти й стори (2а п. 10).** Типово у хвилі 1 (лише веб): без автоматичної модерації. Діють скарги, приховування, вилучення і текст згоди (P7). Перед сторами потрібні: блокування учасника учасником, контакт для скарг з відповіддю за 24 год, видалення за запитом, політика щодо неповнолітніх. Окремо — чи потрібне автоматичне визначення недоречного контенту (Vision SafeSearch, платно).
11. **Сила розмиття.** Типово — 32 px основа. Обличчя й текст не впізнаються, але колір і композиція видні («щось червоне»). Сильніше — 16 px: лише пляма кольору, менше інтриги.
12. **Вартість.** Пам'ять Cloud Run 512 МіБ → **1 ГіБ**, щоб дві обробки 48 Мп не вбили єдиний екземпляр: ≈ +3–5 $/міс при `min-instances=1`. Storage: ~250 КБ на фото, група з 15 людей на 24 дні ≈ 90 МБ — копійки. Інакше — `processing` = 1 і довша черга в пікові хвилини.
13. **Бакет.** Типово — окремий GCS-бакет `commandvibe-ks-photos` у `europe-central2` з забороною публічного доступу (одна команда `gcloud`, вище). Альтернатива — типовий бакет Firebase Storage (створюється в консолі, регіон незворотний). Тоді в коді змінюється лише `PHOTOS_BUCKET`.
