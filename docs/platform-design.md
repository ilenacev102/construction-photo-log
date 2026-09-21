# Платформен дизајн — Construction Photo Log

> **Статус:** Активен · **Верзија:** 1.0 · **Датум:** 2026-08-21
>
> Ова е синтезен документ што ги обединува визијата, целната архитектура и тековната состојба на платформата. Деталните извори остануваат авторитативни за своите домени:
>
> | Извор | Домен |
> |---|---|
> | `docs/spec.md` (v0.1) | Оригинален MVP опсег |
> | `docs/STRATEGY-v2.0-construction-evidence-os.md` | Позиционирање, ICP, core loop, 90-дневен план |
> | `docs/SPEC-v2.1-construction-evidence-os.md` | Продукт спецификација, схема, state machines, sync протокол |
> | `docs/TECH-v2.2-construction-evidence-os.md` | Техничка архитектура, миграции, RLS, API контракти |
> | `docs/PLAN-2026-08-19-nova-dimenzija.md` | Конкурентска анализа, хардвер, иновации, roadmap |
> | `docs/feature-gaps-audit.md` | Аудит на празнини |

---

## 1. Визија и позиционирање

Платформата се развива од „фото дневник“ кон **Construction Evidence OS**: оперативен систем за докази на градилиштето. Фотографијата не е прилог — таа е примарен објект: анотираната фотографија *е* пораката, пинот *е* локацијата, @спомнувањето *е* доделувањето.

**Основни принципи (заклучени одлуки):**

- **Evidence First, AI Second** — секој заклучок мора да води до проверлив извор.
- **AI NEVER CREATES FACTS WITHOUT SOURCE EVIDENCE** — AI тврдења без изворен доказ не постојат како факти.
- **Офлајн-first не е функција, туку производ** — апликација што не може да слика офлајн е мртва на терен.
- **Нула-фрикција за субизведувачи** — лесен идентитет без полна сметка, без billing seat.

**ICP:** мали и средни специјализирани изведувачи (specialty contractors). Купувачот е сопственик/менеджер; корисниците се мајстори и надзорници на терен.

**Core Loop:** `CAPTURE → UNDERSTAND → ASSIGN → ACKNOWLEDGE → PROVE`

1. **Capture** — фотографија со EXIF/GPS печат, офлајн сигурна.
2. **Understand** — AI класификација како *сугестија*, никогаш како факт.
3. **Assign** — @спомнување по улога, пинирано на локација.
4. **Acknowledge** — следење потврда, автоматска ескалација при timeout.
5. **Prove** — верификуван запис → PDF извештај за инспекција/рекламација.

---

## 2. Технолошки стек (тековна имплементација)

| Слој | Технологија |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes + Supabase (Auth, PostgreSQL, Storage) |
| PDF | `packages/photo-report-pdf/` (Python пакет, standalone open source) |
| i18n | next-intl, 5 локали: mk, en, de, sl, sr |
| Тестови | Vitest (304 тестови / 36 фајла, зелени) |
| Deployment | Vercel (web) + Supabase (backend) |

---

## 3. Целна архитектура (Construction Evidence OS)

### 3.1 Дијаграм (финализиран во TECH v2.2)

```text
                CONSTRUCTION EVIDENCE OS
                           │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
  MOBILE                WEB               SERVER
     │                   │                   │
  Capture             Review             Command Gateway
  SQLite (outbox)     Dashboard          Validation (OCC)
  Camera/GPS/Voice    Reports            State Machine (work+proof)
  Offline queue       Admin              Event Store (append-only)
  Upload manager      Contracts          Projections (materialized)
                      Evidence           Media Controller (signed URLs)
                      Notifications      Notifications (outbox)
                                         AI Claim Pipeline
     │                   │                   │
     └───────────────────┼───────────────────┘
                         ↓
                    COMMAND → EVENT → PROJECTION
```

- **Mobile = capture layer** (нативно рано): камера, GPS, глас, локален SQLite outbox, upload manager.
- **Web = management layer**: преглед, dashboard, извештаи, админ, договори, известувања.
- **Server = command gateway**: валидација со Optimistic Concurrency Control, state machines, event store, проекции, медиа контролер, notification outbox, AI claim pipeline.

### 3.2 Command → Event → Projection

Експлицитен pipeline (не CRUD+events мешано):

1. Клиент испраќа **command** со `expected_version` (OCC).
2. Server валидира против state machine, серијализира по aggregate (`aggregate_heads` + `SELECT ... FOR UPDATE`).
3. **Event** се append-ува во append-only event log со `aggregate_version`.
4. **Проекции** се материјализираат за читање; replay е детерминистички.

### 3.3 Податочни слоја (4 логички слоја)

| Слој | Содржина |
|---|---|
| **IDENTITY** | `auth.users` → `public.profiles` (Supabase Auth е canonical), memberships, lightweight worker identity |
| **OPERATIONS** | projects, locations, trades, evidence media, issues, contracts (+ versions) |
| **IMMUTABILITY** | events (append-only), `aggregate_heads`, ai_claims (+ sources), sync/command receipts |
| **DELIVERY** | notifications, deliveries, media jobs |

### 3.4 State machines (две одделни)

- **Work state** — животниот циклус на задачата/прашањето, со експлицитни return paths и `REOPENED`.
- **Proof state** — одделен циклус на доказот (никогаш мешан со work состојбата).
- Server-authoritative, event-sourced; клиентот само предлага транзиции.

### 3.5 Offline-first sync

- Клиентски outbox = локална **SQLite** (WAL mode) со `local_schema_version`, `migration_version`, `installation_id`.
- Server води `sync_receipts` со статуси: accepted / duplicate / rejected / conflict.
- Конфликти: OCC за критично, LWW само за non-critical метаподатоци.
- Idempotency преку `(device_id, client_event_id)`; opportunistic sync (Wi-Fi-only upload опција).

### 3.6 Media lifecycle

`pending → uploaded → processing → ready → failed → quarantined → archived` — signed URLs, без јавни bucket-ови.

### 3.7 Известувања

Notification **Outbox** → FCM/APNs push + SMS fallback → `notification_deliveries` за tracking. Realtime: MVP Postgres Changes; подоцна Broadcast + private channels. Ескалационен патерн: тригер → рутирање по улога/сериозност → push+SMS → acknowledgment tracking → автоматска ескалација при timeout.

### 3.8 AI Claim Pipeline

- Секој AI резултат е **claim** со комплетна provenance (provider, model_id, model_version, prompt_version, schema_version).
- Per-claim-type confidence прагови; confidence ≠ веројатност за точност.
- **Human confirmation loop** — AI сугерира, човек потврдува; потврденото станува verified evidence.
- Правило за модели: VLM за јазичниот слој, YOLO/SAM 2 за пикселниот; никогаш свои модели.

---

## 4. Модули — тековна состојба

| Модул | Статус | Белешки |
|---|---|---|
| Проекти + фотографии (EXIF/GPS/timeline) | ✅ Работи | Основниот MVP опсег |
| PDF извештаи | ✅ Работи | Python пакет, standalone open source |
| Присуство (QR attendance) | ✅ Работи | Реален QR генериран во AttendancePanel → `/checkin?projectId=<uuid>` страна со UUID валидација + auth guard; i18n ×5 |
| Дефекти, пинови, дневни дневници, audit log | ✅ Работат | Бесплатни за сите планови |
| Billing | ⏸️ Full-free mode | `BILLING_ENABLED=false` master switch: checkout CTA скриени, free план unlimited лимити (`null`/`true`), SQL тригери регенерирани; Stripe код зад гейт за идно активирање |
| Покани | ⚠️ Делумно | `/api/invite` постои; UI поврзаност во тек |
| Work orders / задачи | 📋 Планирано | Побарана функција (види roadmap Фаза 1) |
| Offline-first mobile capture | 📋 Планирано | Најголем архитектурен скок (нативен слој) |
| AI claims / voice-first | 📋 Планирано | Фаза 3 |

---

## 5. Безбедност и авторизација

- **RLS матрица** со SQL политики (TECH v2.2, дел B) — authorization matrix по улога, helper функции.
- **Идентитет:** authenticated user е актор; `device_id` е само telemetry/audit.
- **Покани:** email/phone binding, one-time, expiry, revocation, `max_attempts`, rate limiting.
- **API грешки:** RFC 7807 формат.
- **Познати предуслови од аудитот** (PLAN Фаза 0): rate limiting на API, Supabase auth подесувања, RLS/RPC поправки, audit_logs immutability.

---

## 6. Празнини (резиме од аудит)

Критични затворени (2026-08-21):

- ~~A2: QR attendance stub~~ → реален QR + checkin страна (оваа сесија).
- ~~A1: Free Trial CTA без trial период~~ → moot со full-free mode; Stripe патот останува зад `BILLING_ENABLED`.

Отворени (backlog, по приоритет):

1. **B4:** `/admin/team` dead link за site_manager (скриј или дозволи).
2. **A5:** Trade templates недостижни (табела + hook постојат, ништо не ги импортира).
3. **A6:** Feature flags не се спроведуваат за defects/pins/audit/daily-logs.
4. **B2/B3:** Invite UI и client portal површини.
5. **B5–B8:** Project edit/delete/archive UI, profile страница, onboarding, поправка на worker dashboard линкот.
6. **C:** Мртов код (`useTrades`, `CanPermission`, `useSubscription`; дупликат `web/supabase/migrations/`).

---

## 7. Roadmap (од PLAN nova-dimenzija)

### Фаза 0 — Предуслови (1–2 недели, паралелно)
Rate limiting + Supabase auth подесувања · Web CI (GitHub Actions: lint + typecheck + test) · RLS/RPC поправки · a11y/UX закрпи.

### Фаза 1 — Photo-first комуникација (4–6 недели)
Анотирани фотографии како пораки · пинирање на план/мапа · @спомнувања + push/SMS · acknowledgment + авто-ескалација · WebSocket live фид · офлајн-first ред · WhatsApp-нула-фрикција UX.

### Фаза 2 — Телефонски можности (3–5 недели)
QR чек-пунктови (највисок ROI; Ed25519 tamper-evidence опција) · EXIF печат · geofence присуство · документ скан (VisionKit/ML Kit) · нативно BLE/LiDAR каде има смисла.

### Фаза 3 — Издржливи иновации (6–10 недели)
Voice-first фотација (Whisper → структуриран запис) · AI дневни извештаи (VLM → JSON → PDF pipeline) · **same-viewpoint споредба** (единствениот диференцијатор) · VLM класификација со човечка потврда.

### Фаза 4 — Интеграции (по потреба)
Webhook out (HMAC-SHA256) кон Procore/ACC/Teams · schedule import + weather · WhatsApp in-chat бот · live камери како viewing слој.

---

## 8. Отворени прашања

1. **PWA vs native app** — кога е вистинскиот момент за native capture layer (BLE/beacon/LiDAR бараат native)?
2. **WhatsApp канал** — in-chat бот како канал за адопција, или само нула-фрикциска web UX?
3. **Ценовен модел** — unlimited-users (Procore модел) vs per-seat; моментално moot (full-free), но стратешки важен за monetization фазата.
4. **Приоритет на диференцијаторот** — same-viewpoint споредба веднаш по Фаза 1, или после AI извештаите?
5. **Гео-означени/верификувани дневници на македонскиот пазар** — фронт или бек карактеристика?
