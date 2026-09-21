# Construction Evidence OS — Product & Technical Specification v2.1

> **Internal категорија:** Construction Evidence OS · **Customer-facing категорија:** Jobsite Evidence Platform
> **Датум:** 2026-08-19 · **Статус:** Locked for engineering · **Верзија:** 2.1
> **Наследува:** `docs/STRATEGY-v2.0-construction-evidence-os.md`
> **Цел на овој документ:** schema + state machine + sync protocol + AI contract решени **пред** code generation. Ова е основата врз која може да работи Gemini/Claude — без да гради „убав UI над нестабилен core“.

---

## 0. Заклучени одлуки (Founding Decisions)

Овие одлуки се **фиксирани** и не се отвораат повторно за време на имплементацијата:

### 0.1 Хиерархија на вредност (корегирана од v2.0)

```text
OFFLINE
GPS
CAMERA
PUSH
SYNC
     ↓
TABLE STAKES            ← parity requirement, НЕ moat
     ↓
PHOTO → ACTION → PROOF
     ↓
DIFFERENTIATION
     ↓
STRUCTURED EVIDENCE GRAPH
     ↓
LONG-TERM MOAT
```

> **Offline = parity, не moat.** Autodesk Forma официјално поддржува mobile work offline, project downloads, photos, issues и background sync (2026: подобрен photo sync + QR support). OpenSpace има offline workflows. Raken има mobile photo capture директно во project records/daily logs. Затоа offline, GPS, camera, push и sync се **table stakes** — предуслов, не конкурентна предност.

### 0.2 Структура на диференцијација (три слоја)

| Тип | Што |
|---|---|
| **Product differentiator** | Guided Re-Capture |
| **Workflow differentiator** | Required Evidence (Accountability Engine) |
| **Data moat** | Structured Evidence Graph + Workflow Memory |

### 0.3 Positioning — две нивоа

| Ниво | Категорија | Зошто |
|---|---|---|
| Internal | **Construction Evidence OS** | архитектурна визија |
| Customer-facing | **Jobsite Evidence Platform** | „OS“ звучи enterprise; „Jobsite Evidence“ директно ја кажува вредноста |

### 0.4 Landing page — еден dominant promise

> # Capture. Assign. Prove.
>
> **Turn every jobsite photo into accountable construction evidence.**

```text
CAPTURE
Photo + GPS + time

ASSIGN
Owner + deadline + notification

PROVE
After photo + verification + audit trail
```

Landing page **не почнува** со: AI · QR · LiDAR · offline · integrations. Тие се secondary.

### 0.5 Product Law

> **Every photo must answer one of three questions:**
>
> **What happened?**
> **Who needs to act?**
> **How do we know it is done?**

### 0.6 Core принцип

# Evidence First, AI Second

> **The system must remain valuable with AI turned off.**

Ако AI падне: camera работи, offline работи, assignment работи, issue работи, verification работи, reports работат. AI само го намалува friction. Ова е product test — ако системот зависи од AI, направил си AI gimmick.

### 0.7 Core invariant

# AI NEVER CREATES FACTS WITHOUT SOURCE EVIDENCE.

Секоја AI изјава мора да има:

```text
claim
+ source evidence
+ confidence
+ model
+ timestamp
+ human verification state
```

### 0.8 ICP за MVP — една вертикала

**Една трговија, не осум.** Препорачано прво: **Electrical** (Install → inspect → defect → repair → final proof).

| Зошто една вертикала | Ефект |
|---|---|
| Terminology е позната | onboarding полесен |
| AI classification е полесна | подобри tags / issue types |
| Templates се подобри | Evidence Contracts поточни |
| Marketing е поостар | „за electrical contractors“ |

(Останатите: HVAC, Plumbing, Concrete, Facade, Roofing, Drywall, Fire protection — следни по докажан loop.)

### 0.9 Купувач vs корисник

| Улога | Кој |
|---|---|
| **User** | Field worker |
| **Daily user** | Site supervisor |
| **Champion** | Project manager |
| **Economic buyer** | Owner / operations manager |
| **Secondary buyer** | QA/QC / safety / claims |

### 0.10 Why now?

1. Mobile capture е веќе standard.
2. AI може да структурира photo/voice input.
3. Construction teams се веќе overloaded со software.
4. Existing platforms се широки suites.
5. Contractors имаат потреба од **proof**, не уште еден dashboard.
6. AI reports стануваат commodity (OpenSpace AI Voice Notes, Raken AI daily summaries).
7. Mobile/offline capability е очекувана, не differentiator (Autodesk).

> **Timing аргумент:** AI може да ја претвори фотографијата во структурирана operational data единица. Тоа е посилно од „уште еден AI report“.
---

## 1. Final Product Architecture

### 1.1 Архитектурен дијаграм (финален)

```text
CONSTRUCTION EVIDENCE OS
│
├── MOBILE APP (React Native / Expo)
│     ├── Camera · GPS · Voice capture
│     ├── Local SQLite (offline-first)
│     ├── Evidence capture flows
│     └── Notifications (push)
│
├── WEB APP (Next.js)
│     ├── Dashboard · Reports · Admin
│     ├── Evidence Review / Verification
│     └── Project & Team Management
│
├── SYNC ENGINE          ← first-class module
│     ├── Outbox (Local SQLite)
│     ├── Idempotency (client_event_id + device_id)
│     └── Conflict resolution
│
├── API / BFF
│     ├── REST (Supabase) + Realtime
│     └── Auth (magic link) · RLS
│
├── EVIDENCE GRAPH + EVENT LOG
│     ├── Structured evidence (tables)
│     └── Append-only event log (tamper-evident)
│
├── AI LAYER (post-pilot)
│     ├── Extract · Compare · Summarize
│     └── Provider-agnostic orchestrator
│
└── HUMAN CONFIRMATION
      └── VERIFIED EVIDENCE
```

### 1.2 Модули (и со кои слоеви на моат се поврзани)

| Модул | Опис | Моат слој |
|---|---|---|
| **Capture Engine** | Photo + GPS + timestamp + metadata | Table stakes |
| **Sync Engine** | Offline-first, outbox, idempotency | Table stakes |
| **Action Engine** | Issues, assignment, push, due dates, escalation | Differentiation |
| **Required Evidence** | Evidence Contracts — секој action дефинира каков proof е потребен | Workflow differentiator |
| **Guided Re-Capture** | Phone-native повторна фотографија од иста позиција | Product differentiator |
| **Evidence Graph** | Структурирани врски: evidence ↔ issues ↔ reports ↔ media | Data moat |
| **Report Engine** | Event-driven извештаи — data е authoritative, AI е presentation layer | Retention |
| **Evidence Intelligence** (post-pilot) | Auto-extraction, voice capture, suggested actions, search | Future moat |

### 1.3 Accountability Engine (Workflow differentiator)

Споредбата што ја продаваме:

```text
WhatsApp:        „Проблем со кабел.“

Evidence OS:    Electrical issue → Marko → due 16:00
                → acknowledgment → completion photo required
                → same viewpoint → verified → closed
```

**Required Evidence е product, не feature.** Кога некој ќе креира action, системот знае кој proof е потребен за „done“ — и го тера целиот тим да го достави тој proof. Ова е основата на довербата.

### 1.4 Report Engine — event-driven, не AI-driven

```text
Evidence Graph
   → Verified Events
      → Report Builder
         → Human-readable summary
            → PDF
```

**Data is authoritative. AI is presentation layer.** Извештајот е само проекција на verified events — никогаш AI генерација врз непроверен текст.

### 1.5 Мoat структура (консолидирано)

| Слој | Што | Како се одбранува |
|---|---|---|
| **Product differentiator** | Guided Re-Capture | UX + camera alignment на phone-native workflow |
| **Workflow differentiator** | Required Evidence (Evidence Contracts) | Имплементиран во core loop; тежок за copy без цел систем |
| **Data moat** | Evidence Graph + Workflow Memory | Accumulated data: trade → issue types → locations → teams → resolution time → required evidence → before/after patterns → recurring problems |

> **Workflow Memory пример (long-term):** „Electrical issues на Level 3 историски земаат 3.4 часа и обично бараат 2 evidence photos.“ → AI учи како **овој** contractor работи.
---

## 2. Final PostgreSQL/Supabase Schema

> Сите 6 корекции од v2.0 review се имплементирани овде: evidence_media, evidence_issues (M2M), evidence_comparisons, membership-scoped identity, magic link hash, append-only event log со client_event_id.

### 2.1 Identity & Membership (корекција #4)

**Принцип:** `users` = identity, `organization_members` / `project_members` = membership. **Ролa е на membership scope**, не на user.

```sql
-- Identity
create table users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Membership: иста личност може да е Manager во една орг, Viewer во друга
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now()
);

create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('project_manager','site_supervisor','field_worker','subcontractor','viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
```

**Пример за иста личност (од v2.0 review):** Marko е `owner` во organization_members (негова фирма), `project_manager` во Project A, `viewer` во Project B, `subcontractor` во Project C.

### 2.2 Auth — magic link (корекција #5)

**Токен никогаш не се чува plaintext.**

```sql
create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null,
  project_id uuid references projects(id) on delete cascade,
  scope text not null check (scope in ('organization','project')),
  created_by uuid not null references users(id),
  magic_link_token_hash text not null unique,  -- sha256(token), НИКОГАШ plaintext
  magic_link_expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invitations_email on invitations(email);
```

**Flow:** POST /auth/magic-link → server генерира token → чува само `sha256(token)` → испраќа линк со token во URL → клик → server пресметува sha256 и бара match → `used_at` = now → создава членство.

### 2.3 Projects, Locations, Trades

```sql
create table locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,                          -- "Level 3", "Zone B"
  parent_id uuid references locations(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                    -- electrical, hvac, plumbing...
  icon text
);
```

### 2.4 Evidence Core (корекции #1 и #2)

```sql
-- Една evidence = еден capture event. Медиумите се посебна табела (корекција #1).
create table evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  location_id uuid references locations(id),
  captured_by uuid not null references users(id),
  captured_at timestamptz not null,
  device_id text not null,                     -- за idempotency + audit
  client_event_id uuid not null,               -- генериран на клиент, за offline idempotency
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_m double precision,             -- на пр. 7m (корекција #13)
  location_confidence text not null default 'low'
    check (location_confidence in ('high','medium','low')),
  location_verified_by text check (location_verified_by in ('gps','qr_checkpoint','manual')),
  integrity_sha256 text not null,              -- хеш на оригиналниот медиум (корекција #14)
  device_timestamp timestamptz not null,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (device_id, client_event_id)          -- идемпотентност при offline sync
);

-- Медиуми: оригинал, compressed, thumbnail, after, annotation, video, документ... (корекција #1)
create table evidence_media (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  variant text not null check (variant in (
    'original','compressed','thumbnail','after','annotation','video','document','generated_report_image'
  )),
  storage_path text not null,                  -- Supabase Storage path
  mime_type text not null,
  file_size_bytes bigint not null,
  width int,
  height int,
  created_at timestamptz not null default now(),
  unique (evidence_id, variant)
);

-- Една evidence може да: креира issue, да е прикачена, да е proof, да е поврзана со inspection, да е референцирана во report (корекција #2)
create table evidence_issues (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  issue_id uuid not null references issues(id) on delete cascade,
  relation text not null check (relation in (
    'created_by','attached','proof_after','inspection','report_reference'
  )),
  created_at timestamptz not null default now(),
  unique (evidence_id, issue_id, relation)
);

-- Before/After: НЕ self-reference на evidence (корекција #3)
create table evidence_comparisons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  before_evidence_id uuid not null references evidence(id),
  after_evidence_id uuid not null references evidence(id),
  comparison_type text not null check (comparison_type in ('guided_recapture','before_after','manual')),
  similarity_score double precision,           -- 0..1, AI-filled
  alignment_data jsonb,                        -- perspective transform params
  ai_summary text,                             -- AI-filled, human-verified
  created_at timestamptz not null default now()
);

create index idx_evidence_project on evidence(project_id, captured_at desc);
create index idx_evidence_location on evidence(location_id);
create index idx_evidence_issues_issue on evidence_issues(issue_id);
```

### 2.5 Issues & Evidence Contracts

```sql
create table evidence_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  trade_id uuid references trades(id),
  action_type text not null,                   -- 'defect_report','installation','inspection','concrete_pour'...
  name text not null,
  config jsonb not null,                       -- requirement дефиниција (видете 2.6)
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  location_id uuid references locations(id),
  contract_id uuid references evidence_contracts(id),
  title text not null,
  description text,
  status text not null default 'open' check (status in (
    'open','acknowledged','in_progress','fixed','verified','closed','escalated'
  )),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  assigned_to uuid references users(id),
  due_at timestamptz,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index idx_issues_project_status on issues(project_id, status);
create index idx_issues_assigned on issues(assigned_to, status);
```

### 2.6 Evidence Contract config (JSON) — пример

**Концепт (од v2.0 review):** секој action дефинира кој evidence е потребен за task completion. Configurable evidence workflow engine.

```jsonc
// defect_report (electrical, fire protection sleeve)
{
  "required_evidence": [
    { "type": "photo", "viewpoint": "same_viewpoint", "required": true },
    { "type": "photo", "annotations": true, "required": false },
    { "type": "location", "required": true, "confidence": "high" },
    { "type": "responsible_trade", "required": true },
    { "type": "completion_confirmation", "required": true }
  ],
  "verification": { "requires_inspector_ack": true }
}

// concrete_pour
{
  "required_evidence": [
    { "type": "photo", "stage": "before", "required": true },
    { "type": "photo", "stage": "during", "required": true },
    { "type": "photo", "stage": "after", "required": true }
  ],
  "timestamps": { "required": true },
  "location": { "required": true },
  "verification": { "requires_inspector_ack": true }
}
```

### 2.7 Append-only Event Log (корекција #6)

```sql
create table evidence_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_id uuid not null,
  aggregate_type text not null,                -- 'issue','evidence','evidence_comparison'
  event_type text not null,                    -- 'created','acknowledged','fixed','verified'...
  actor_type text not null check (actor_type in ('user','system','ai')),
  actor_id uuid,
  device_id text,
  client_event_id uuid not null,               -- за offline idempotency
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}',
  previous_event_hash text,                    -- верига (tamper-evident)
  event_hash text not null,                    -- sha256(prev_hash + payload + occurred_at)
  unique (device_id, client_event_id)
);

create index idx_events_aggregate on evidence_events(aggregate_id, occurred_at);
```

**Hash chain:** секој event чува `previous_event_hash` од претходниот event за истиот aggregate → менување на било кој историски event ја крши веригата → audit trail е заштитен.

### 2.8 AI Claims (корекции #15, #16, #17)

```sql
create table ai_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_media_id uuid references evidence_media(id),
  claim_type text not null check (claim_type in ('issue_detection','classification','summary','before_after')),
  claim jsonb not null,                        -- структуриран JSON, пример во Дел 7
  confidence double precision not null check (confidence between 0 and 1),
  model text not null,                         -- на пр. 'claude-sonnet-4', 'gpt-4o'
  provider text not null,                      -- 'anthropic','openai','local'
  human_verified boolean not null default false,
  verified_by uuid references users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ai_claims_media on ai_claims(source_media_id);
```

> **Invariant:** AI **никогаш** не пишува директно во `issues.*` или `evidence.*`. AI пишува само во `ai_claims`; човечка потврда (или изрична user акција) е таа што креира факт. „AI suggestion: Yes · Confidence 0.87 · Source Photo #8934 · Human verified: No“ — потоа „Verified by User #123 at 08:42“.

### 2.9 Sync Outbox (корекција #12)

```sql
create table sync_outbox (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  device_id text not null,
  client_event_id uuid not null,
  entity_type text not null,                   -- 'evidence','evidence_media','issue','event'
  entity_id uuid,
  payload jsonb not null,
  status text not null default 'pending' check (status in (
    'pending','uploading','synced','retrying','failed','conflict'
  )),
  attempt_count int not null default 0,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_event_id)
);

create index idx_outbox_status on sync_outbox(status, next_retry_at);
```
---

## 3. Evidence State Machine

### 3.1 Issue lifecycle

```text
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    v                                              │
┌────────┐   assign   ┌──────────────┐   ack    ┌──────────────┐   │
│  open  │──────────→│ acknowledged  │─────────→│ in_progress  │───┘
└────────┘            └──────────────┘          └──────┬───────┘
   │                                                   │
   │ escalate                                          │ fix_submitted
   v                                                   v
┌──────────┐                                       ┌────────┐
│ escalated│←──────────────────────────────────────│ fixed  │
└──────────┘                                       └───┬────┘
                                                       │ proof_required
                                                       v
                                                   ┌──────────┐
                                                   │ verified │
                                                   └────┬─────┘
                                                        │ close
                                                        v
                                                   ┌────────┐
                                                   │ closed │
                                                   └────────┘
```

**Транзиции (guarded):**

| From | To | Trigger | Guard |
|---|---|---|---|
| open | acknowledged | user аck | assigned_to != null |
| open | escalated | escalate | priority=critical OR due_at past |
| acknowledged | in_progress | start_work | assigned_to = actor |
| in_progress | fixed | fix_submitted | contract required evidence доставено (ако има) |
| fixed | verified | verify | inspector/PM акција + required proof present |
| verified | closed | close | — |
| any | escalated | escalate | — |

### 3.2 Evidence lifecycle (per aggregate)

```text
┌──────────┐   capture   ┌───────────┐   upload   ┌────────┐   link   ┌─────────┐
│ captured │───────────→│  local    │──────────→│ synced │────────→│ linked  │
└──────────┘            └───────────┘           └────────┘          └────┬────┘
                                                                        │ proof_submitted
                                                                        v
                                                                   ┌──────────┐
                                                                   │  proof   │
                                                                   └────┬─────┘
                                                                        │ verified
                                                                        v
                                                                   ┌──────────┐
                                                                   │ verified │
                                                                   └──────────┘
```

- `captured` → local SQLite, има `client_event_id` + `device_id` (идемпотентност).
- `local` → sync_outbox `pending`.
- `synced` → server received, `integrity_sha256` проверен.
- `linked` → поврзано со issue преку `evidence_issues`.
- `proof` → доставено како required evidence за некој contract.
- `verified` → човечка потврда.

### 3.3 State machine = server-authoritative, event-sourced

1. **Сите транзиции пишуваат event** во `evidence_events` (append-only).
2. **Тековната состојба е проекција** (issues.status, sync_outbox.status) — може да се реконструира од event log.
3. **Offline клиент локално го применува истиот state machine** на SQLite; sync испраќа events, не цели состојби.
4. **Конфликт** → sync_outbox.status = `conflict` → resolved со last-write-wins по `occurred_at` + human review ако е потребно.

---

## 4. Offline Sync Protocol

### 4.1 Flow (first-class module)

```text
Capture
   → Local SQLite (evidence + events)
      → Outbox (sync_outbox)
         → Sync Engine
            → API (Supabase REST)
               → Postgres
                  → Realtime (push на други клиенти)
```

### 4.2 Outbox states

| State | Значење | Action |
|---|---|---|
| pending | креирано локално, не испратено | send |
| uploading | во тек | — |
| synced | server потврди | mark done |
| retrying | транзиентна грешка | backoff retry (next_retry_at) |
| failed | трајна грешка | human alert |
| conflict | server reject / version mismatch | resolve |

**Retry политика:** exponential backoff (1s → 2s → 4s → … cap 5min), `attempt_count` increment, `last_error` log.

### 4.3 Idempotency

- Секој клиентски запис има `client_event_id` (uuid генериран на клиент) + `device_id`.
- Server уникатност: `unique(device_id, client_event_id)` на `evidence` и `evidence_events`.
- Ако клиент ретраира, server враќа 200 со постоечкиот запис — **без дупликати**.

### 4.4 Conflict resolution

1. **Server ги валидира** payload events (RLS, schema, integrity_sha256).
2. **Version check:** aggregate има `version` (инкрементално со секој event).
3. Ако клиентската верзија != server верзија → `conflict` → клиентот повлекува server state, прикажува diff на user, user одлучува (merge / override / discard).
4. `last-write-wins` по `occurred_at` како default за non-critical fields.

### 4.5 GPS & Location confidence

- `gps_lat/lng` + `gps_accuracy_m` (на пр. 7m).
- **GPS ≠ Location verified.** `location_confidence` = high/medium/low.
- `location_verified_by`: `gps` (default, low confidence) / `qr_checkpoint` (high) / `manual`.
- QR checkpoint на лице место (постер/табела со QR) = **повисока доверба** од GPS.

### 4.6 Evidence Integrity Model

Секоја evidence има:

```text
✓ SHA-256 hash on upload (integrity_sha256, проверен на server)
✓ Capture metadata (device_timestamp, captured_at, device_id)
✓ Location recorded (gps + accuracy + confidence)
✓ Actor identified (captured_by)
✓ Audit trail intact (event chain, tamper-evident)
```

**Original file е preserved** — compressed/thumbnail се изведени, оригиналот не се модифицира.

### 4.7 Sync протокол (endpoint контракт)

```text
POST /sync/batch
  body: { device_id, events: [{ client_event_id, aggregate_type, event_type, payload, occurred_at }] }
  response: { accepted: [...], conflicts: [...], errors: [...] }

GET /sync/delta?after=<cursor>
  → инкрементални server events за offline клиент
```

Батчинг: максимум ~50 events / batch, прогресивен upload на големи медиуми (original → compressed → thumbnail), media преку Supabase Storage signed URL.
---

## 5. Mobile UX Specification

### 5.1 Навигациска структура (Mobile)

```text
Tab 1: Camera (home) — „Capture. Assign. Prove.“
Tab 2: Issues — мои / сите / по статус
Tab 3: Evidence Feed — сите фотографии/докази по проект
Tab 4: Profile / Project switcher
```

**Camera е home.** Field worker отвора апликација и веднаш е спремен да слика — без тапкања.

### 5.2 Core flow: Photo → Action → Proof

```text
1. TAP CAMERA
   → photo + GPS + timestamp + device metadata (автоматски)

2. CLASSIFY (2 тапови макс)
   → issue / progress / completion
   → (optional) прикачи на постоечки issue или креирај нов

3. ASSIGN (за issue)
   → trade → личност → due date
   → push notification на assignee

4. PROOF (кога ќе се заврши)
   → Required Evidence: after photo од иста позиција (Guided Re-Capture)
   → verification од inspector/PM
```

### 5.3 Guided Re-Capture — UX спецификација

**Позиционирање (корегирано од v2.0):** Не тврдиме „никoј го нема“. Користиме:

> **Validated product hypothesis:** phone-native guided re-capture appears under-served relative to 360°/fixed-camera solutions and warrants focused differentiation testing.

**Flow:**

```text
1. Корисникот тапка „After photo“ на затворен/фиксен issue.
2. Телефонот ги прикажува alignment hints од оригиналната фотографија:
   - претходната фотографија како полу-транспарентен overlay
   - horizon line + edge alignment guides
   - „Move closer / Step left“ инструкции (реално време)
3. Сторирана фотографија → `evidence_comparisons` (before/after) → similarity_score (AI, post-pilot)
4. Verification → closed
```

**Guided Re-Capture е phone-native предност:** нема 360° камера, нема fixed mounting — само добар alignment UX на екран.

### 5.4 Offline-first UX

- Целосна функционалност без мрежа: capture, classify, assign, ack.
- „Saved locally“ индикатор на секоја фотографија додека не се синхронизира.
- Sync статус bar: `✓ Synced` / `⟳ Pending (3)` / `⚠ Failed`.
- Оригиналот останува на уредот додека upload не е потврден.

### 5.5 Evidence Contract UX

Кога корисникот креира issue, системот покажува **што треба да се достави** за „done“ (според contract-от):

```text
Contract: defect_report (electrical)
  ☐ Photo (same viewpoint)      — required
  ☐ Location (high confidence)  — required
  ☐ Responsible trade           — required
  ☐ Completion confirmation     — required
```

Корисникот секогаш знае колку proof останува — прогресивно исполнување на contract-от.

### 5.6 Notification UX

| Тип | Кога | Содржина |
|---|---|---|
| Assigned | нова задача | „Electrical issue #123 assigned to you — due 16:00“ |
| Acknowledged | assignee акнува | „Marko acknowledged #123“ |
| Due soon | 1h пред due | „#123 due in 1h — after photo pending“ |
| Escalated | критично | „#123 escalated — requires attention“ |
| Verified | потврдено | „#123 verified ✓“ |

### 5.7 Camera permissions / GPS

- Camera + GPS + storage: required на прво отворање, со jазик „за construction evidence“.
- GPS accuracy индикатор при capture („±7m“), low accuracy предупредување.
- QR checkpoint scan за high-confidence location (постер/табела на локација).

---

## 6. Web UX Specification

### 6.1 Навигациска структура (Web)

```text
Sidebar:
  Dashboard
  Projects
  Issues
  Evidence
  Reports
  Team
  Settings (contracts, integrations)
```

### 6.2 Dashboard (site supervisor / PM view)

- **Verification queue** (issues во `fixed` кои чекаат verify) — прво на страната.
- Отворени issues по trade / location / priority.
- Due today / overdue.
- North Star индикатор: Verified Evidence Rate (дневна/неделна).
- Time-to-Proof тренд.

### 6.3 Evidence Review / Verification

```text
Issue #123 (fixed)
├── Original photo (captured 2026-08-19 09:12 · GPS ±7m · by Marko)
├── After photo (Guided Re-Capture alignment: 0.94)
├── Contract checklist:
│     ☑ Photo same viewpoint
│     ☑ Location verified
│     ☑ Responsible trade: Electrical
│     ☑ Completion confirmation
└── [Verify ✓] [Request re-work ↺]
```

### 6.4 Reports (event-driven)

- Избор: date range + project + trade.
- Секој report = проекција на verified events (никогаш AI текст без source).
- Export: PDF (branded), CSV.
- AI summary (post-pilot) со доверба и provenance линк до source evidence.

### 6.5 Admin: Evidence Contracts builder

- CRUD за `evidence_contracts` — корисникот дефинира кој proof е потребен за секој action type.
- Template library по trade (electrical: defect_report, installation, inspection…).

### 6.6 Team & Roles

- Organization members / project members со scoped roles.
- Invitations (magic link) — статус: pending / used / revoked / expired.

---

## 7. AI Contract & JSON Schemas

### 7.1 Принцип: provider-agnostic

```text
AI Orchestrator
   → Vision Provider (Anthropic / OpenAI / local — swappable)
      → Structured JSON
         → Validation (schema + confidence threshold)
            → ai_claims таблица
               → Human confirmation
                  → факт (issue/evidence/report)
```

**Не hard-code OpenAI или Claude.** Provider се конфигурира; contract-от е JSON schema, provider е имплементација.

### 7.2 Контракт: issue_detection

```jsonc
{
  "schema_version": "1.0",
  "claim_type": "issue_detection",
  "source_media_id": "uuid",
  "model": "claude-sonnet-4-20250514",
  "provider": "anthropic",
  "confidence": 0.87,
  "claim": {
    "issue_type": "missing_cable_tray",
    "trade": "electrical",
    "severity": "medium",
    "title_suggestion": "Missing cable tray support at Level 3",
    "location_hint": {"zone": "Level 3", "estimated": true}
  }
}
```

**После човечка потврда:** `human_verified=true, verified_by=<uuid>, verified_at=...` → дури тогаш issue се креира.

### 7.3 Контракт: before_after (Guided Re-Capture alignment)

```jsonc
{
  "schema_version": "1.0",
  "claim_type": "before_after",
  "source_media_id": "uuid-after",
  "reference_media_id": "uuid-before",
  "model": "gpt-4o",
  "provider": "openai",
  "confidence": 0.92,
  "claim": {
    "same_viewpoint": true,
    "similarity_score": 0.94,
    "alignment": {"rotation_deg": 2.1, "scale": 1.03, "translation_px": [12, -5]},
    "differences_detected": ["cable_tray_installed"]
  }
}
```

### 7.4 Контракт: summary (reports)

```jsonc
{
  "schema_version": "1.0",
  "claim_type": "summary",
  "model": "claude-sonnet-4-20250514",
  "provider": "anthropic",
  "confidence": 0.81,
  "claim": {
    "summary": "14 issues resolved this week; 9 verified with after-photos; avg Time-to-Proof 2h17m.",
    "source_aggregate_ids": ["uuid1", "uuid2", "..."]
  }
}
```

**Source evidence е задолжителна** — секој AI тврдење мора да има линк до verify-able source, инаку не се прикажува.

### 7.5 Validation rules (server-side)

1. JSON schema валидација (Zod на edge / Supabase RPC).
2. `confidence >= 0.6` за авто-прикажување; под тоа → draft.
3. `human_verified=false` → никогаш не станува факт во issues/evidence.
4. Непознат provider/model → reject.

---

## 8. Exact 90-Day Engineering Backlog

> **Главен deliverable:** „3 real construction sites using it daily“ — НЕ „12 features completed.“

### 8.1 Фази

| Денови | Фаза | Цел | Milestone |
|---|---|---|---|
| 1–14 | **Foundation** | security, RLS, CI, rate limiting, storage, event model, evidence schema, sync protocol | **Backend contracts locked** |
| 15–35 | **Capture** | React Native app, auth, project select, camera, GPS, SQLite, upload queue, sync, photo metadata | **„Take Photo → Saved“ < 5 sec** |
| 36–58 | **Action** | annotation, issue creation, assignment, push, ack, due date, escalation, evidence feed | **Photo → assigned action < 10 sec** |
| 59–78 | **Proof** | required evidence, after photo, verification, before/after, evidence integrity, audit trail | **Issue → verified proof** |
| 79–90 | **Pilot hardening** | crash monitoring, sync reliability, battery, poor-network, 5–10 real crews, onboarding, permissions, usage analytics, feedback, bug fixing | **3 real construction sites using it daily** |

### 8.2 Foundation (1–14) — backend contracts locked

- Supabase project + RLS политики на сите табли (org/project scoped).
- CI/CD (GitHub Actions): lint, type check, migrations test.
- Rate limiting на auth + sync endpoints.
- Storage buckets + signed URLs + integrity_sha256 проверка.
- `evidence_events` + hash chain имплементација.
- `sync_outbox` + `POST /sync/batch` контракт.
- Magic link auth + invitations.

### 8.3 Capture (15–35) — „Take Photo → Saved“ < 5 sec

- React Native / Expo апликација.
- Auth (magic link) + project selection.
- Camera + GPS + metadata capture.
- Local SQLite + outbox + sync engine (offline-first).
- Photo metadata (device_timestamp, integrity hash).

### 8.4 Action (36–58) — „Photo → assigned action“ < 10 sec

- Annotation (drawing) на фотографија.
- Issue creation + classification (manual MVP; AI post-pilot).
- Assignment + push notification + ack.
- Due date + escalation.
- Evidence feed (timeline по project).

### 8.5 Proof (59–78) — „Issue → verified proof“

- Required Evidence (Evidence Contracts) enforcement.
- After photo + Guided Re-Capture (alignment hints — MVP version).
- Verification flow (inspector/PM).
- Before/after (`evidence_comparisons`).
- Evidence integrity + audit trail view.

### 8.6 Pilot hardening (79–90) — „3 real sites daily“

- Crash monitoring (Sentry), sync reliability telemetry.
- Battery impact тестови (full-day field use).
- Poor-network тестови (elevator, basement, remote).
- Onboarding flow + permissions tuning.
- Usage analytics (drop-offs at each step).
- Feedback loop + bug fixing.

> **AI почнува ПОСЛЕ пилотот** — требаат реални photos/annotations/issues/resolutions прво. Phase 4 (post-pilot) = **Evidence Intelligence**: auto extraction, voice capture, suggested action, evidence summary, search („Show unresolved electrical issues on Level 3“).

### 8.7 KPI дефиниција (split Product / Reliability / Business)

| Категорија | KPI |
|---|---|
| **Product** | capture→action conversion · acknowledgement rate · issue resolution rate · after-photo completion · verification rate |
| **Reliability** | capture success rate · offline sync success rate · median sync latency · upload failure rate · crash-free sessions · battery impact |
| **Business** | weekly active crews · projects activated · projects retained · time saved/project · evidence records/project · paid conversion |

### 8.8 North Star Metric

> **Verified Evidence Rate** = verified evidence records / actionable evidence records

Пример: 1000 actionable → 730 verified = **73%**.

### 8.9 Time-to-Proof (selling metric)

- Дефиниција: issue created → after evidence verified.
- Споредбена метрика: **WhatsApp 8h24m vs Evidence OS 2h17m**.
- Се прикажува во dashboard и sales material.

---

## 9. Appendix — Checklist за code generation

Пред Gemini/Claude да почне со code:

- [ ] Migrations за сите табли од Дел 2 (со RLS).
- [ ] State machine (Дел 3) како server-authoritative модул + клиентска проекција.
- [ ] Sync protocol (Дел 4) контракти + idempotency тестови.
- [ ] AI contract (Дел 7) JSON schemas + validation.
- [ ] Mobile UX (Дел 5) и Web UX (Дел 6) screens.
- [ ] 90-day backlog (Дел 8) со KPI gates на секоја фаза.

---
*Крај на документот. Оваа спецификација е основицата за сите следни code generation задачи — сите архитектурни и data-model одлуки се locked.*