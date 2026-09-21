# Construction Evidence OS — Technical Architecture & Implementation Contract v2.2

> **Тип:** Engineering contract (единствен документ за code generation)
> **Датум:** 2026-08-19 · **Статус:** Draft — v2.2 (по 29 корекции од review на v2.1)
> **Наследува:** `docs/SPEC-v2.1-construction-evidence-os.md` (стратегија и продукт одлуки остануваат)
> **Цел:** Затвори identity, event consistency, sync semantics, migrations, RLS, media lifecycle. **Без нови features.**
> **Инструкција за code generation:** *"Do not invent architecture. Implement this contract exactly."*

---

## 0. Клучни архитектурни одлуки (v2.2 — нови/изменети)

| # | Одлука | v2.1 | v2.2 |
|---|---|---|---|
| 1 | Identity | `public.users` (independent) | **`auth.users` → `public.profiles`** (Supabase Auth е canonical identity) |
| 2 | Migrations | една огромна | **bounded migrations по domain (8 migrations)** |
| 3 | Sync outbox | server има client queue | **client queue = локална SQLite; server има `sync_receipts`** |
| 4 | Dedup | `unique(device_id, client_event_id)` | **`sync_receipts` со status: accepted/duplicate/rejected/conflict** |
| 5 | Concurrency | LWW по `occurred_at` (general) | **Optimistic Concurrency Control: `expected_version` + command**; LWW само за non-critical metadata |
| 6 | Event chain | hash chain (недефинирано serialization) | **per-aggregate, строго serialized: `aggregate_heads` + `SELECT ... FOR UPDATE`** |
| 7 | Events | нема version | **`aggregate_version` на секој event** |
| 8 | State machine | `escalated` како паралелна состојба без return | **explicit return paths + `REOPENED`** |
| 9 | Work/Proof | `fixed` = proof submitted (мешано) | **Work state и Proof state одделни** |
| 10 | Contracts | само `config jsonb` (definition) | **`evidence_requirements` = runtime instance; Contract = TEMPLATE** |
| 11 | Contracts versioning | нема | **`contract_versions` + `contract_version` на issue** |
| 12 | AI provenance | `model` hard-coded пример | **provider + model_id + model_version + prompt_version + schema_version** |
| 13 | AI confidence | global ≥ 0.6 | **per-claim-type thresholds; confidence ≠ probability of correctness** |
| 14 | Guided Re-Capture | AI comparison за MVP | **V1 ghost overlay (geometry) → V2 auto alignment (CV) → V3 semantic (AI)** |
| 15 | Mobile flow | секоја фотографија класифицирана | **Take Photo → Save прво; action само ако е потребен** |
| 16 | Push | „push“ без architecture | **Notification Outbox + FCM/APNs + `notification_deliveries`** |
| 17 | Realtime | „Supabase Realtime WebSockets“ | **MVP: Postgres Changes; Scale: Broadcast + private channels** |
| 18 | Media | upload само | **media lifecycle: pending→uploaded→processing→ready→failed→quarantined→archived** |
| 19 | SQLite | `device_id` само | **+ `local_schema_version`, `migration_version`, `installation_id`** |
| 20 | Trust | `device_id` како identity | **Actor identity = authenticated user; device_id = telemetry/audit only** |
| 21 | RLS | „со RLS“ | **authorization matrix + SQL политики (Дел B)** |
| 22 | Invitations | `magic_link_token_hash` само | **+ email/phone binding, one-time, expiry, revocation, `max_attempts`, rate limiting** |
| 23 | Worker identity | „без full account“ | **lightweight identity** (има user, limited membership, no billing seat) |
| 24 | 90-day | „3 sites daily“ (outcome) | **+ kill criteria (Continue/Pivot/Kill feature)** |
| 25 | Architecture | CRUD + events мешано | **Command → Event → Projection (explicit pipeline)** |
| 26 | DB слоеви | нема | **4 логички слоја: IDENTITY / OPERATIONS / IMMUTABILITY / DELIVERY** |
| 27 | State machines | една | **две одделни: work + proof** |
| 28 | Product architecture | v2.1 дијаграм | **финализиран (Дел 0.1)** |
| 29 | Rating | — | **цел: ~9.3/10 по корекциите** |

---

## 0.1 Final Product Architecture (v2.2 — финализирана)

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
       Offline queue       Admin             Event Store (append-only)
       Upload manager      Contracts         Projections (materialized)
                            Evidence          Media Controller (signed URLs)
                            Notifications     Notifications (outbox)
                                               AI Claim Pipeline
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ↓
                         COMMAND → EVENT → PROJECTION
                              │
             ┌────────────────┼────────────────┐
             ↓                ↓                ↓
           MEDIA            ISSUES          CONTRACTS
           (evidence_       (issues,        (evidence_contracts,
            media)           state machines)  contract_versions)
             │                │                │
             └────────────────┼────────────────┘
                              ↓
                     EVENT LOG (append-only)
                     aggregate_heads + hash chain
                              ↓
                       AI CLAIMS (+ ai_claim_sources)
                              ↓
                      HUMAN CONFIRMATION
                              ↓
                       VERIFIED EVIDENCE
                              ↓
                            REPORTS
```

---

## A. Supabase Schema + Migration Order

### A.1 Стратегија за migrations

**Bounded migrations by domain** — НЕ една огромна migration. Секоја migration е независна, реверзибилна, и ги содржи само своите објекти.

```text
Migration 001 → identity:      auth/profiles, organizations, organization_members, projects, project_members
Migration 002 → operations:    locations, trades, issues, evidence, evidence_media, evidence_issues, evidence_comparisons
Migration 003 → contracts:     evidence_contracts, contract_versions, contract_requirements, evidence_requirements
Migration 004 → immutability:  evidence_events, aggregate_heads, ai_claims, ai_claim_sources, sync_receipts, command_receipts
Migration 005 → delivery:      notifications, notification_deliveries, media_processing_jobs, integration_jobs
Migration 006 → security:      RLS политики + security-definer helper функции
Migration 007 → indexes:       дополнителни индекси (CONCURRENTLY каде што е потребно)
Migration 008 → realtime:      publication/replica identity за Realtime (Postgres Changes)
```

**Правила:**
- Секоја migration работи на свој домен — `evidence_issues` ја референцира `issues` **внатре во истата migration (002)**, никогаш пред да постои.
- FK референци само кон табли што веќе постојат (или се креирани порано во истата migration).
- **Bounded by responsibility, не точно 5:** migrations се групирани по одговорност (identity/operations/contracts/immutability/delivery/security/indexes/realtime), не по произволен број (корекција #26).
- RLS политики и helper функции во Migration 006 (последна security), откако сите табли постојат.
- Индекси во истата migration како табелата, освен ако не бараат `CONCURRENTLY` (тогаш во 007).

### A.2 4 логички слоја (и каде живеат)

```text
IDENTITY        auth.users, profiles, organizations, organization_members, project_members
OPERATIONS      projects, locations, trades, issues, evidence, evidence_media, evidence_issues,
                evidence_comparisons, evidence_contracts, contract_versions, contract_requirements,
                evidence_requirements
IMMUTABILITY    evidence_events, aggregate_heads, ai_claims, ai_claim_sources, sync_receipts, command_receipts
DELIVERY        notifications, notification_deliveries, media_processing_jobs, integration_jobs
```

---

### A.3 Migration 001 — Identity

**Критично:** НЕ креираме `public.users`. Supabase Auth веќе има canonical identity во `auth.users`. Креираме само `public.profiles` што го референцира.

```sql
-- profiles: application-specific, го референцира auth.users(id)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trigger: автоматско креирање profile при нов auth user
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''           -- корекција: празен search_path, се експлицитно public.
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'avatar_url', null)
  on conflict (id) do nothing;                  -- идемпотентно: повторно повикување не креира дупликат
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- организации
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- membership: иста личност може да е Manager во една орг, Viewer во друга
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('project_manager','site_supervisor','field_worker','subcontractor','viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- invitations: врзано со email/phone, organization, project, role, expiry, one-time, revocation
create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text,
  phone text,
  role text not null,
  project_id uuid references projects(id) on delete cascade,
  scope text not null check (scope in ('organization','project')),
  created_by uuid not null references auth.users(id),
  magic_link_token_hash text not null unique,  -- sha256(token), НИКОГАШ plaintext
  magic_link_expires_at timestamptz not null,
  max_attempts int not null default 5,          -- brute-force protection
  attempt_count int not null default 0,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create index idx_invitations_email on invitations(email);
create index idx_invitations_phone on invitations(phone);
```

> **Lightweight identity (корекција #23):** worker има user identity (`auth.users` + `profiles`), limited project membership (`project_members`), минимален onboarding, **без billing seat**. *Free subcontractor ≠ accountless subcontractor.*

---

### A.4 Migration 002 — Operations (issues + evidence + media + comparisons)

**Редослед е важен:** `issues` се креира **пред** `evidence_issues` (корекција #2). Целата група е во една migration, но FK се решаваат во правилен редослед.

```sql
create table locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  parent_id uuid references locations(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text
);

-- ISSUES прво (evidence_issues зависи од нив)
create table issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  location_id uuid references locations(id),
  title text not null,
  description text,
  status text not null default 'open' check (status in (
    'open','acknowledged','in_progress','fixed','reopened','verified','closed','escalated'
  )),
  proof_state text not null default 'missing' check (proof_state in (
    'missing','partial','submitted','verified','rejected'
  )),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  contract_version_id uuid,          -- FK кон contract_versions (Migration 003); овде само placeholder колона
  projection_version bigint not null default 0,   -- верзија на materialized projection (Дел C.5)
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

-- EVIDENCE
create table evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  location_id uuid references locations(id),
  captured_by uuid not null references auth.users(id),
  captured_at timestamptz not null,
  device_id text not null,                     -- telemetry/audit context, НЕ trust anchor
  installation_id uuid not null,               -- конкретна инсталација на app (корекција #19)
  client_event_id uuid not null,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_m double precision,
  location_confidence text not null default 'low'
    check (location_confidence in ('high','medium','low')),
  location_verified_by text check (location_verified_by in ('gps','qr_checkpoint','manual')),
  capture_manifest_hash text not null,   -- hash на целата capture (сите media + метадата); НЕ per-file hash
  device_timestamp timestamptz not null, -- device-reported (клиентски часовник, недоверлив)
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (installation_id, client_event_id)
);

create table evidence_media (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  variant text not null check (variant in (
    'original','compressed','thumbnail','after','annotation','video','document','generated_report_image'
  )),
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  content_sha256 text not null,     -- hash на самиот binary file (per-media integrity; НЕ на evidence ниво)
  width int,
  height int,
  media_status text not null default 'pending' check (media_status in (
    'pending','uploaded','processing','ready','failed','quarantined','archived'
  )),
  created_at timestamptz not null default now(),
  unique (evidence_id, variant)
);

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

create table evidence_comparisons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  before_evidence_id uuid not null references evidence(id),
  after_evidence_id uuid not null references evidence(id),
  comparison_type text not null check (comparison_type in ('guided_recapture','before_after','manual')),
  similarity_score double precision,
  alignment_data jsonb,
  ai_summary text,
  created_at timestamptz not null default now()
);

create index idx_evidence_project on evidence(project_id, captured_at desc);
create index idx_evidence_location on evidence(location_id);
create index idx_evidence_issues_issue on evidence_issues(issue_id);
create index idx_issues_project_status on issues(project_id, status);
create index idx_issues_assigned on issues(assigned_to, status);
```

> **Timestamp семантика (фиксирана):** `device_timestamp` = device-reported (клиентски часовник, НИКОГАШ trust anchor); `captured_at` = клиентски capture event timestamp (се поставува од клиент, валидира се против `server_received_at`); `server_received_at` = серверска ingestion. За Verified Evidence, `capture_time` се известува како пар: `reported_at` (клиент) + `server_received_at` (сервер) — никогаш само клиентската вредност.

### A.5 Migration 003 — Contracts (versioned)

**Contract = TEMPLATE. Requirement = RUNTIME INSTANCE.** И versioned (корекции #10 и #11):

```sql
create table evidence_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  trade_id uuid references trades(id),
  action_type text not null,
  name text not null,
  is_default boolean not null default false,
  active boolean not null default true,       -- корекција #11
  created_at timestamptz not null default now()
);

create table contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references evidence_contracts(id) on delete cascade,
  version integer not null default 1,
  config jsonb not null,
  created_at timestamptz not null default now(),
  unique (contract_id, version)
);

create table contract_requirements (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references contract_versions(id) on delete cascade,
  requirement_type text not null,
  required boolean not null default true,
  config jsonb not null default '{}',
  position int not null default 0,
  unique (contract_version_id, position)
);

-- runtime instance: issue врзана за конкретна contract верзија
create table evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues(id) on delete cascade,
  contract_version_id uuid not null references contract_versions(id),
  contract_requirement_id uuid not null references contract_requirements(id),
  requirement_key text not null,        -- стабилен key од contract (на пр. photo_before, photo_during, photo_after, inspector_ack)
  requirement_type text not null,
  required boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending','submitted','accepted','rejected','waived')),
  fulfilled_by_evidence_id uuid references evidence(id),
  fulfilled_at timestamptz,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (issue_id, requirement_key)   -- дозволува повеќе photo requirements (пример: before + during + after)
);

-- сега можеме да ги врземе issues → contract_versions (колоната постоеше од 002)
alter table issues
  add constraint fk_issues_contract_version
  foreign key (contract_version_id)
  references contract_versions(id);
```

> **Зошто versioned:** ако electrical defect contract се смени од v1 → v2, старите issues остануваат врзани за v1. `evidence_requirements` инстанцирана од v1 останува валидна.

**Пример contract_versions.config (v1):**

```jsonc
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
```

---

### A.6 Migration 004 — Immutability (events + aggregate_heads + ai_claims + sync_receipts + command_receipts)

```sql
-- event log: append-only, tamper-evident, per-aggregate serialized
create table evidence_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,  -- RLS anchor (корекција #9)
  aggregate_id uuid not null,
  aggregate_type text not null check (aggregate_type in ('issue','evidence','evidence_comparison')),
  aggregate_version bigint not null,           -- корекција #7: детерминистички replay
  event_type text not null,
  actor_type text not null check (actor_type in ('user','system','ai')),
  actor_id uuid,
  device_id text,                              -- telemetry context, не trust
  installation_id uuid,
  client_event_id uuid not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}',
  previous_event_hash text,                    -- per-aggregate chain (корекција #6)
  event_hash text not null,
  unique (installation_id, client_event_id)
);

-- aggregate_heads: per-aggregate serialization point (корекција #6)
create table aggregate_heads (
  aggregate_id uuid primary key,
  aggregate_type text not null,
  version bigint not null default 0,
  last_event_id uuid,
  last_event_hash text,
  updated_at timestamptz not null default now()
);

create index idx_events_aggregate on evidence_events(aggregate_id, aggregate_version);

-- AI claims: provenance + confidence + human verification
create table ai_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_media_id uuid references evidence_media(id),
  claim_type text not null check (claim_type in ('issue_detection','classification','summary','before_after')),
  claim jsonb not null,
  confidence double precision not null check (confidence between 0 and 1),
  provider text not null,
  model_id text not null,                      -- корекција #12: 'provider-model-id', не hard-coded име
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  human_verified boolean not null default false,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ai_claims_media on ai_claims(source_media_id);

-- ai_claim_sources: M2M — еден claim референцира повеќе извори (корекција #8)
-- before_after има 2 media; summary има evidence + events; issue_detection има media + issue контекст
create table ai_claim_sources (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references ai_claims(id) on delete cascade,
  source_type text not null check (source_type in ('media','evidence','issue','event','report')),
  source_id uuid not null,
  relation text not null,                 -- на пр. 'before', 'after', 'summary_base', 'context'
  created_at timestamptz not null default now(),
  unique (claim_id, source_type, source_id, relation)
);

create index idx_ai_claim_sources_claim on ai_claim_sources(claim_id);

-- sync_receipts: server одговор за секој клиентски event (корекција #4)
create table sync_receipts (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  installation_id uuid,
  client_event_id uuid not null,
  server_event_id uuid,
  aggregate_id uuid,
  aggregate_version bigint,
  status text not null check (status in ('accepted','duplicate','rejected','conflict')),
  error_code text,
  created_at timestamptz not null default now(),
  unique (device_id, client_event_id)
);

create index idx_sync_receipts_device on sync_receipts(device_id, created_at desc);

-- command_receipts: синхрона идемпотенција за команди (корекција #23)
-- Разлика од sync_receipts: sync_receipt = резултат од offline event ingestion;
-- command_receipt = резултат од синхрон API command (POST /v1/issues/{id}/...).
create table command_receipts (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null unique,        -- иста команда двапати → duplicate, никаков side-effect
  actor_id uuid not null references auth.users(id),
  command_name text not null,
  aggregate_id uuid not null,
  aggregate_type text not null,
  result_status text not null check (result_status in ('accepted','duplicate','rejected','conflict')),
  server_event_id uuid,                        -- пополнето само кога се апендирал event
  created_at timestamptz not null default now()
);

create index idx_command_receipts_aggregate on command_receipts(aggregate_id, created_at desc);
```

> **Sync flow (корекција #3):** client queue живее **само** во локална SQLite. Server не ја држи целата client queue — има event ingestion, dedup (sync_receipts), processing result, cursor.

### A.7 Migration 005 — Delivery (notifications + deliveries + media jobs)

```sql
-- notifications: домен објект (тип, наслов, тело, контекст) — извор на вистина за „што“ се случило
create table notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  issue_id uuid references issues(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

-- notification deliveries (корекција #16): Assigned ≠ Delivered ≠ Acknowledged
create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,  -- FK (корекција: нема orphans)
  user_id uuid not null references auth.users(id),
  channel text not null check (channel in ('push','email','in_app')),
  provider text not null check (provider in ('fcm','apns','resend','in_app')),
  provider_message_id text,
  status text not null default 'pending' check (status in (
    'pending','sent','delivered','opened','failed'
  )),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

-- media processing jobs: thumbnail, compression, AI hooks (корекција #18)
create table media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references evidence_media(id) on delete cascade,
  job_type text not null check (job_type in ('thumbnail','compress','ai_extract','ai_compare')),
  status text not null default 'queued' check (status in ('queued','processing','done','failed')),
  attempt_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table integration_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  job_type text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers (за сите mutable табли)
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger issues_set_updated_at before update on issues
  for each row execute procedure public.set_updated_at();
-- (истиот trigger за секоја табела со updated_at)
```

**RLS политики и дополнителни индекси → Дел B (authorization matrix + SQL).**

---

## B. RLS Policy Matrix + SQL

### B.1 Принципи (корекции #20, #21)

1. **Actor identity = authenticated user.** Device identity = telemetry/audit context само. **Никогаш `device_id → permission`.**
2. **Permission = user + project membership + RLS.** `service_role` key никогаш не се изложува client-side.
3. Денy by default — секоја табела има explicit `using`/`with check`.
4. RLS е **посебен дел од спецификацијата**, не „со RLS“.

### B.2 Authorization matrix

| Resource | Field Worker | Supervisor | PM | Owner |
|---|---|---|---|---|
| Own evidence | CRUD | CRUD | CRUD | CRUD |
| Other evidence (same project) | read | CRUD | CRUD | CRUD |
| Create issue | ✓ | ✓ | ✓ | ✓ |
| Assign issue | own only | ✓ | ✓ | ✓ |
| Verify | ✗ | ✓ | ✓ | ✓ |
| Close | ✗ | ✓ | ✓ | ✓ |
| Contracts | ✗ | read | CRUD | CRUD |
| Audit log | own events | project | project | org |

### B.3 Helper functions

```sql
-- СИТЕ helper-и: security definer + set search_path = '' + експлицитно public. (корекција #10)
-- revoke/grant на крајот: НИКОЈ освен authenticated не смее да ги повика.

-- дали user е член на организацијата
create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

-- дали user има одредена улога во организацијата (корекција #1: projects INSERT)
create or replace function public.has_org_role(org_id uuid, allowed text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.role = any (allowed)
  );
$$;

-- дали user е член на проектот (било која project role) — основниот authorization предикат
create or replace function public.is_project_member(proj_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = proj_id
      and pm.user_id = auth.uid()
  );
$$;

-- дали user има одредена улога во проектот (project member)
create or replace function public.has_project_role(proj_id uuid, allowed text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = proj_id
      and pm.user_id = auth.uid()
      and pm.role = any (allowed)
  );
$$;

-- project_id на evidence (преку evidence)
create or replace function public.evidence_project(ev_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select project_id from public.evidence where id = ev_id;
$$;

-- project_id на issue (за evidence_requirements и evidence_issues политики)
create or replace function public.issue_project(issue_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select project_id from public.issues where id = issue_id;
$$;

-- organization_id на проект
create or replace function public.project_org(proj_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select organization_id from public.projects where id = proj_id;
$$;

-- helper-ите се internal: само authenticated (преку RLS), никогаш public/anon директно
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
revoke execute on function public.is_project_member(uuid) from public, anon;
revoke execute on function public.has_project_role(uuid, text[]) from public, anon;
revoke execute on function public.evidence_project(uuid) from public, anon;
revoke execute on function public.issue_project(uuid) from public, anon;
revoke execute on function public.project_org(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.has_project_role(uuid, text[]) to authenticated;
grant execute on function public.evidence_project(uuid) to authenticated;
grant execute on function public.issue_project(uuid) to authenticated;
grant execute on function public.project_org(uuid) to authenticated;
```

### B.4 RLS политики (Migration 005)

```sql
alter table public.profiles enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table locations enable row level security;
alter table issues enable row level security;
alter table evidence enable row level security;
alter table evidence_media enable row level security;
alter table evidence_issues enable row level security;
alter table evidence_comparisons enable row level security;
alter table evidence_contracts enable row level security;
alter table contract_versions enable row level security;
alter table contract_requirements enable row level security;
alter table evidence_requirements enable row level security;
alter table evidence_events enable row level security;
alter table aggregate_heads enable row level security;
alter table ai_claims enable row level security;
alter table sync_receipts enable row level security;
alter table notification_deliveries enable row level security;
alter table media_processing_jobs enable row level security;
alter table integration_jobs enable row level security;

-- profiles: само сопствен профил (корекција #4). Team/org UI оди преку контролиран server query,
-- никогаш преку широк `select` од client.
create policy "profiles_self" on profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- projects: член на организацијата може да чита; INSERT само owner/admin на организацијата
create policy "projects_org_select" on projects
  for select using (public.is_org_member(organization_id));
create policy "projects_org_admin" on projects
  for insert with check (public.has_org_role(organization_id, array['owner','admin']));
-- NOTE: клиент НИКОГАШ не прави INSERT во projects директно. Server прима команда,
-- креира project + project_members(owner/project_manager) во една трансакција (корекција #1).

-- project_members: член на организацијата може да чита; додавање само PM/owner на проектот
create policy "project_members_select" on project_members
  for select using (public.is_org_member(public.project_org(project_id)));
create policy "project_members_admin" on project_members
  for insert with check (public.has_project_role(project_id, array['project_manager','owner']));

-- issues: само project members читаат и креираат (корекција #2, #3)
create policy "issues_select" on issues
  for select using (public.is_project_member(project_id));
create policy "issues_insert" on issues
  for insert with check (created_by = auth.uid() and public.is_project_member(project_id));
create policy "issues_update_self" on issues
  for update using (
    public.is_project_member(project_id)
    and (
      assigned_to = auth.uid() or created_by = auth.uid()
      or public.has_project_role(project_id, array['project_manager','site_supervisor'])
    )
  );

-- evidence: сопствена CRUD, туѓа (project) read, supervisor+ CRUD (корекција #2, #3)
create policy "evidence_select" on evidence
  for select using (public.is_project_member(project_id));
create policy "evidence_insert" on evidence
  for insert with check (captured_by = auth.uid() and public.is_project_member(project_id));
create policy "evidence_update_own" on evidence
  for update using (
    public.is_project_member(project_id)
    and (
      captured_by = auth.uid()
      or public.has_project_role(project_id, array['project_manager','site_supervisor'])
    )
  );

-- evidence_media / evidence_issues / evidence_comparisons / evidence_requirements:
-- project membership преку релацијата, НЕ преку org (корекција #2)
create policy "evidence_media_select" on evidence_media
  for select using (public.is_project_member(public.evidence_project(evidence_id)));
create policy "evidence_issues_select" on evidence_issues
  for select using (public.is_project_member(public.evidence_project(evidence_id)));
create policy "evidence_comparisons_select" on evidence_comparisons
  for select using (public.is_project_member(project_id));
create policy "evidence_requirements_select" on evidence_requirements
  for select using (public.is_project_member(public.issue_project(issue_id)));

-- evidence_events: project_id е вистинска колона, НЕ payload (корекција #9)
create policy "events_project_read" on evidence_events
  for select using (public.is_project_member(project_id));
create policy "aggregate_heads_project_read" on aggregate_heads
  for select using (
    exists (
      select 1 from public.evidence_events ev
      where ev.aggregate_id = aggregate_heads.aggregate_id
        and public.is_project_member(ev.project_id)
    )
  );

-- ai_claims: project members read, само verified-by човечка потврда се изложуваат како факт
create policy "ai_claims_select" on ai_claims
  for select using (public.is_project_member(project_id));

-- sync_receipts: само сопствениот device/installation
create policy "sync_receipts_self" on sync_receipts
  for select using (installation_id = (select auth.jwt()->>'installation_id')::uuid);

-- command_receipts: само сопствените команди
create policy "command_receipts_self" on command_receipts
  for select using (actor_id = auth.uid());

-- notifications: project members читаат; deliveries само сопствените
create policy "notifications_project_read" on notifications
  for select using (
    project_id is null
    or public.is_project_member(project_id)
    or exists (
      select 1 from public.notification_deliveries nd
      where nd.notification_id = notifications.id and nd.user_id = auth.uid()
    )
  );
create policy "notifications_self" on notification_deliveries
  for select using (user_id = auth.uid());

-- default deny за сите останати табли (без политика = deny)
```

> **Секогаш се проверуваат и: Storage bucket политики (Дел G), Realtime authorization (Дел H), invitation rate limiting (Дел J).**

---

## C. Command → Event → Projection Contracts

### C.1 Pipeline (корекција #25)

```text
USER ACTION
    ↓
COMMAND
    ↓
VALIDATION (permission + contract/state + expected_version)
    ↓
STATE TRANSITION
    ↓
EVENT (append to evidence_events, per-aggregate serialized)
    ↓
PROJECTION (issues.status, proof_state, sync_receipts...)
    ↓
REALTIME (Postgres Changes / Broadcast)
```

**Frontend никогаш директно не update-ва `issues.status`.** Праќа команда; сервер валидира, транзитира, апендира event, проектира.

### C.2 Command контракт

```jsonc
{
  "command": "acknowledge_issue",
  "aggregate_id": "issue-123",
  "aggregate_type": "issue",
  "expected_version": 7,          // корекција #5: optimistic concurrency
  "actor_id": "user-456",
  "payload": {},
  "installation_id": "inst-1",
  "client_event_id": "evt-789"
}
```

**Пример:**

```text
POST /issues/123/acknowledge

  → AcknowledgeIssue command
    → permission check
    + contract/state validation
    + expected_version = 7
    → IssueAcknowledged event (v8)
    → issues.status = acknowledged
    → notification
    → Realtime update
```

### C.3 Concurrency (корекција #5)

- **Workflow state (verified, closed, acknowledged, escalation, evidence deletion, contract completion):** ОCC — `expected_version` мора да одговара на `aggregate_heads.version`.
  - `expected_version = 7`, server `version = 7` → **accepted** → version 8.
  - `expected_version = 6`, server `version = 8` → **conflict** → client повлекува server state, diff, human decide.
- **LWW по `occurred_at` само за non-critical metadata** (на пр. `issue.priority`, `description` edit) — никогаш за workflow state.

> Зошто не LWW за workflow: Worker A „issue verified“ vs Worker B „issue reopened“ со различни offline timestamps — **later timestamp ≠ truth.**

### C.4 Serialized append (корекција #6)

```sql
-- server append, per aggregate, строго serialized:
begin;
select version from aggregate_heads
  where aggregate_id = 'issue-123'
  for update;                                  -- row lock → serialized

-- (validation тука)

insert into evidence_events (...)
values ('issue-123', v+1, 'IssueAcknowledged', ...,
        (select last_event_hash from aggregate_heads where aggregate_id='issue-123'),
        sha256(prev_hash || payload || occurred_at));

update aggregate_heads
  set version = version + 1, last_event_id = new_event_id, last_event_hash = new_hash;
commit;
```

**Без `SELECT ... FOR UPDATE` два offline уреди може да произведат:**

```text
Event A  previous = X
Event B  previous = X      ← не е chain!
```

**Со aggregate_heads:**

```text
aggregate → aggregate_heads → event1 → event2 → event3   (строго линеарно)
```

### C.5 Deterministic replay (корекција #7)

`aggregate_version` на секој event → issue #123 може да се реконструира:

```text
v1 created
v2 assigned
v3 acknowledged
v4 in_progress
v5 fixed
v6 verified
v7 closed
```

Ова дава: deterministic replay, optimistic concurrency, sync reconciliation, debugging, auditability.

> **Клуч (корекции #20, #21, #22):** replay **никогаш** не е нормалниот query path. Нормалното читање оди преку **materialized projection** (`issues`/`projection_version` во табелите), ажурирана во истата трансакција како event append. Replay (`GET /aggregates/{id}/events`) постои само за: recovery, audit, debugging, sync reconciliation. `projection_version` на секоја агрегатна табела = верзијата на events до која projection-от е ажуриран — коректноста на projection-от се докажува со replay (T08).

---

## D. Complete State Machine Transitions

### D.1 Две одделни машини (корекции #8, #9, #27)

> **`fixed` ≠ „proof submitted“.** Work state и Proof state се две независни машини кои течат паралелно.

### D.2 Work state machine

```text
                  ┌──────────────────────────────────────────┐
                  ▼                                          │
     OPEN ──▶ ACKNOWLEDGED ──▶ IN_PROGRESS ──▶ FIXED ──▶ VERIFIED ──▶ CLOSED
       │            │              │             │           │
       └──────┬─────┴──────────────┴─────────────┴───────────┘
              │                 escalate
              ▼
         ESCALATED ────────────▶ (return to OPEN / ACKNOWLEDGED / IN_PROGRESS)
```

**Транзиции (корекција #8 — explicit return paths):**

| From | To | Command | Guard |
|---|---|---|---|
| OPEN | ACKNOWLEDGED | `acknowledge_issue` | actor ∈ {supervisor, PM, assignee} |
| ACKNOWLEDGED | IN_PROGRESS | `start_work` | actor = assignee |
| IN_PROGRESS | FIXED | `mark_fixed` | actor = assignee (НЕ бара proof — корекција #7) |
| FIXED | VERIFIED | `verify_fix` | actor ∈ {supervisor, PM} + `proof_state ∈ (verified, accepted)` |
| VERIFIED | CLOSED | `close_issue` | actor ∈ {supervisor, PM} |
| OPEN/ACKNOWLEDGED/IN_PROGRESS | ESCALATED | `escalate` | actor = PM/owner, reason required |
| ESCALATED | OPEN | `deescalate_to_open` | PM/owner |
| ESCALATED | ACKNOWLEDGED | `deescalate_to_ack` | PM/owner |
| ESCALATED | IN_PROGRESS | `deescalate_to_progress` | PM/owner |
| FIXED | REOPENED | `reopen_issue` (корекција #8) | supervisor/PM, reason required |
| VERIFIED | REOPENED | `reopen_issue` (корекција #8) | supervisor/PM, reason required |
| REOPENED | IN_PROGRESS | `start_work` | actor = assignee |
| CLOSED | REOPENED | `reopen_issue` | PM/owner, reason required |
| any | any | `update_metadata` | LWW, non-critical fields only (корекција #5) |

### D.3 Proof state machine (корекција #9 — одделна)

```text
   MISSING ──▶ PARTIAL ──▶ SUBMITTED ──▶ VERIFIED ──▶ ACCEPTED
      │           │            │             │
      └───────────┴────────────┴─────────────┴────▶ REJECTED ──▶ (back to MISSING/PARTIAL)
```

**Транзиции:**

| From | To | Command | Guard |
|---|---|---|---|
| MISSING | PARTIAL | `attach_evidence` | evidence added, но contract не е целосен |
| MISSING/PARTIAL | SUBMITTED | `submit_proof` | contract.requirements fulfilled (корекција #10) |
| SUBMITTED | VERIFIED | `verify_evidence` | supervisor/PM + AI claim human-verified |
| VERIFIED | ACCEPTED | `accept_proof` | supervisor/PM |
| SUBMITTED | REJECTED | `reject_proof` | supervisor/PM + reason required |
| REJECTED | MISSING | `restart_proof` | worker + evidence requirement re-opened |
| REJECTED | PARTIAL | `restart_proof_partial` | worker |

### D.4 Врска меѓу машините

```text
IN_PROGRESS → FIXED:   НЕ бара proof — worker може да заврши работа и без доказ (корекција #7)
FIXED → VERIFIED:      бара proof_state ∈ {verified, accepted} — VERIFY е блокирано додека proof не е комплетен

issue.status            issue.proof_state
in_progress             submitted   ← valid combo (fixed≠proof)
fixed                   missing     ← valid combo (worker claims done, но без proof → блокира verify)
```

> **Клуч (корекција #7):** `mark_fixed` **не** бара proof — guard е само `actor = assignee` + валидна работа. Но `verify_fix` бара `proof_state ∈ {verified, accepted}`, така `fixed + missing` е валидна состојба што го блокира VERIFY додека proof не се доврши. Двете машини се ажурираат со одделни команди и посебни events во `evidence_events`.

---

## E. SQLite Local Schema

> Корекции #3, #19: локалната SQLite е **единственото** место за client queue; `installation_id` различен од `device_id`; верзиите на schema се локални.

### E.1 Принципи

1. SQLite е **offline-first storage**, не cache — single source of truth на уредот.
2. `pending_events` = outbox за sync (корекција #3): само клиентската queue. Server никогаш не ја држи целата queue — има ingestion + receipts.
3. Секогаш: `installation_id` (нова при секоја reinstall/clear data) + `device_id` (стабилен per physical device).

### E.2 Schema (SQLite, WAL mode)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- metadata: schema верзии и идентитет
create table app_metadata (
  key text primary key,                    -- 'local_schema_version' | 'migration_version' | 'installation_id' | 'device_id' | 'user_id'
  value text not null
);

create table local_migrations (
  version integer primary key,
  applied_at text not null default (datetime('now'))
);

-- evidence: локална копија (server evidence_id се пополнува по sync)
create table evidence (
  id text primary key,                     -- local uuid
  server_id text,
  project_id text not null,
  location_id text,
  captured_by text not null,
  captured_at text not null,
  device_timestamp text not null,
  gps_lat real,
  gps_lng real,
  gps_accuracy_m real,
  location_confidence text not null default 'low',
  location_verified_by text,
  capture_manifest_hash text not null,  -- hash на целата capture (сите media + метадата); per-media = content_sha256 на media табелата
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','failed')),
  created_at text not null default (datetime('now'))
);

create table media (
  id text primary key,                     -- local uuid
  evidence_id text not null references evidence(id),
  variant text not null,                   -- 'original' | 'compressed' | 'thumbnail' | 'after' | ...
  local_path text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  content_sha256 text not null,          -- hash на самиот binary file (per-media integrity; НЕ на evidence ниво)
  media_status text not null default 'pending',  -- pending | uploaded | processing | ready | failed | quarantined | archived (корекција #18)
  upload_progress real not null default 0,
  created_at text not null default (datetime('now'))
);

-- outbox: единствениот sync queue (корекција #3)
create table pending_events (
  id text primary key,                     -- client_event_id
  aggregate_type text not null,
  aggregate_id text not null,
  expected_version integer,
  event_type text not null,
  payload text not null,                   -- JSON string
  created_at text not null default (datetime('now')),
  sync_attempts integer not null default 0,
  last_error text
);

-- sync cursor: последно синхронизирана позиција
create table sync_state (
  key text primary key,                    -- 'last_synced_at' | 'server_cursor' | 'last_receipt_id'
  value text not null
);

create index idx_pending_events_order on pending_events(created_at);
create index idx_media_evidence on media(evidence_id);
```

### E.3 Sync flow (client side)

```text
1. Снимање evidence/media → запиши во SQLite + enqueue pending_events
2. Connectivity check (offline-first: нема блокирање)
3. Online → POST /sync/batch (сите pending_events, лимит 100)
4. Response: sync_receipts per event → статус accepted/duplicate/rejected/conflict (корекција #4)
5. Успешни → бриши од pending_events; конфликтни → прикажи diff, human decide (корекција #5)
6. Ажурирај sync_state cursor
```

> **Клуч:** `pending_events` се бриши **само** по `accepted`/`duplicate` receipt. `rejected`/`conflict` остануваат со `last_error` за retry или human decision.

---

## F. Sync Batch Schemas + Conflict Protocol

### F.1 Sync batch request

```jsonc
// POST /sync/batch
{
  "installation_id": "inst-uuid",
  "device_id": "physical-device-id",
  "cursor": "abc123",                    // последен примен server_cursor
  "events": [
    {
      "client_event_id": "evt-1",
      "aggregate_type": "evidence",
      "aggregate_id": "ev-1",
      "expected_version": null,           // new aggregate → null
      "event_type": "EvidenceCaptured",
      "occurred_at": "2026-08-19T10:00:00Z",
      "payload": {
        "project_id": "p-1",
        "location_id": "l-1",
        "capture_manifest_hash": "abc...",
        "media": [{ "variant": "original", "size": 4200000, "mime": "image/jpeg", "content_sha256": "def..." }]
      }
    },
    {
      "client_event_id": "evt-2",
      "aggregate_type": "issue",
      "aggregate_id": "issue-123",
      "expected_version": 7,              // OCC (корекција #5)
      "event_type": "IssueAcknowledged",
      "occurred_at": "2026-08-19T10:05:00Z",
      "payload": {}
    }
  ],
  "media_upload_ids": ["m-1"]            // референци на претходно upload-нати media (Дел G)
}
```

### F.2 Sync batch response

```jsonc
{
  "cursor": "next-cursor-xyz",
  "server_time": "2026-08-19T10:06:00Z",
  "receipts": [
    {
      "client_event_id": "evt-1",
      "status": "accepted",
      "server_event_id": "evt-server-1",
      "aggregate_id": "ev-1",
      "aggregate_version": 1
    },
    {
      "client_event_id": "evt-2",
      "status": "conflict",
      "server_event_id": null,
      "aggregate_id": "issue-123",
      "aggregate_version": 8,             // server моментална верзија → client мора да ги повлече
      "error_code": "expected_version_mismatch"
    },
    {
      "client_event_id": "evt-3",
      "status": "duplicate",             // веќе примен претходно
      "server_event_id": "evt-server-1"
    },
    {
      "client_event_id": "evt-4",
      "status": "rejected",
      "error_code": "permission_denied"
    }
  ]
}
```

### F.3 Receipt statuses (корекција #4)

| Status | Meaning | Client action |
|---|---|---|
| `accepted` | Event applied, server_event_id + version assigned | Remove from pending_events |
| `duplicate` | Same client_event_id already received | Remove from pending_events |
| `rejected` | Validation/permission failed | Keep + show error; human decides |
| `conflict` | expected_version mismatch | Fetch server aggregate state → diff → human decide (корекција #5) |

### F.4 Conflict resolution protocol (корекција #5)

```text
1. Client прима conflict receipt (server_version = 8, client очekuваше 7)
2. Client GET /aggregates/issue-123/events?from_version=7  → ги повлекува events 8+ (v8)
3. Client го применува server state локално (rebase)
4. Ако промената е workflow state (acknowledged/verified/...) → human decide:
      „Користи server version“ | „Користи мојата“ | „Merge (LWW за metadata)"
5. Client праќа нова команда со нов expected_version
6. Server ги запишува двата факти: original server event + човечката одлука
```

> **Никогаш автоматски LWW за workflow state.** Само за non-critical metadata (корекција #5).

### F.5 Retry & idempotency

- **Idempotent:** иста `client_event_id` никогаш не се применува двапати (unique constraint + duplicate receipt).
- **Retry:** exponential backoff — 1s → 5s → 30s → 5min → 30min, max 5 attempts, потоа `failed` статус + user notification.
- **Batch limit:** 100 events / batch. Потоа следен batch со нов cursor.

---

## G. Storage / Media Lifecycle

### G.1 Lifecycle (корекција #18)

```text
pending → uploaded → processing → ready
   │          │            │
   │          └──▶ failed ──┘
   └──▶ quarantined (integrity/AV check fail)
   └──▶ archived (soft-delete, original се чува)
```

### G.2 Правила

1. **Original media никогаш не се overwrite-ва** (корекција #18). `variant` е immutable — секоја обработка креира нова `evidence_media` редица со нов variant.
2. Storage key: `{project_id}/{installation_id}/{evidence_id}/{variant}/{media_id}` — колокација за лесен lifecycle.
3. Integrity: `capture_manifest_hash` (целата capture) + `content_sha256` (per media) се проверуваат на upload (клиент) и пред processing (server).
4. Quarantine: virus/AV или hash mismatch → `quarantined`, никогаш автоматски delete.
5. **Server-authorized signed upload URLs** (корекција #14): клиент бара `POST /media/{id}/upload-url` → server резервира media row (`status=pending`) и враќа Supabase `createSignedUploadUrl` ограничена на таа media key + expiry. Клиент upload-ва директно во Storage. Никој не може да upload-ва на key што не е резервирана за него.
6. Media types: original (RAW, се чува), compressed (за web/streaming), thumbnail (за list view), after (за before/after), annotation (стрелки/плоштини), video, document, generated_report_image.
7. **Reconciler (корекција #14):** редовна cron проверка — media со `status=pending` постари од X мин (без upload) → `failed`/`abandoned`; orphan-нати binary во Storage без media row → записи во audit log, никогаш автоматски delete. Ги чисти ресурсите, не ги губи податоците.

### G.3 Guided Re-Capture (корекција #14 — phased)

```text
V1 (MVP):  ghost overlay — претходна photo се прикажува полу-транспарентна, worker ја усогласува рачно
V2:        автоматизирано усогласување (CV feature matching)
V3:        AI semantic difference detection (предлага „земи уште една од истата точка“)
```

**MVP користи само V1** — ghost overlay, без CV/AI dependency.

### G.4 Upload flow

```text
1. Worker фотографира → SQLite записи + pending_events (offline-safe)
2. Клиент POST /media/{id}/upload-url → server резервира media row (status=pending) + враќа signed URL (корекција #14)
3. Клиент upload-ва binary → Storage (parallel, resumable) на резервираната key
4. Server верифицира hash (content_sha256) → media_status = uploaded → processing (thumbnail/compression)
5. По upload → праќа EvidenceCaptured event со media_upload_ids
6. Processing done → ready → Realtime notify (Postgres Changes)
7. Failure → failed + retry queue (media_processing_jobs)
8. Reconciler: pending/abandoned media или orphan binary → audit + cleanup (никогаш автоматски delete)
```

---

## H. Notification Architecture

### H.1 Pipeline (корекција #16)

```text
Action Engine
    ↓
Notification Outbox (notification_deliveries: pending)
    ↓
FCM / APNs / Resend
    ↓
Delivery receipt (sent → delivered → opened)
    ↓
User device
```

> **Assigned ≠ Delivered ≠ Acknowledged.** Секое ниво е посебен статус во `notification_deliveries`.

### H.2 Семантика

| Статус | Значење |
|---|---|
| `pending` | Креирана, уште не пратена |
| `sent` | Пушена кон provider (FCM/APNs) |
| `delivered` | Provider потврдил доставеност до уредот |
| `opened` | Корисникот ја отворил/видел |
| `failed` | Provider вратил грешка (permanent) |

### H.3 Event-driven тригери

```text
IssueAssigned      → notification to assignee
IssueEscalated     → notification to PM + owner
ProofRejected      → notification to worker (reason)
IssueDueSoon       → reminder (scheduler, 24h пред due_at)
EvidenceReady      → supervisor („ново evidence за преглед“)
ContractChanged    → affected assignees
```

### H.4 Realtime (корекција #17)

```text
MVP:  Postgres Changes (Supabase Realtime) — просто, доволно за мали тимови
Scale: Broadcast + private channels — кога ќе има многу clients/сокети
```

**Мерлив scale trigger (корекција #13):** остануваш на Postgres Changes додека < 100 конкурентни активни clients/проект. Штом надминеш 100 конкурентни сокети (или p95 latency > 500 ms на Realtime), преминуваш на Broadcast + private channels. Trigger-от се мери со Realtime usage метрики, не со чувство.

- **Postgres Changes:** само за табели со мала фреквенција на промени (issues, evidence_media.status).
- **Broadcast:** за high-frequency (media upload progress, cursor sync).
- Авторизација: Realtime authorization секогаш проверува project membership (корекција #21, [2] [3]).
- `service_role` key **никогаш** client-side ([6]).
- **RLS на Realtime (корекција #21):** `realtime.messages` / Realtime authorization policies ги користат истите `is_project_member` helper-и како таблите — client никогаш не добива rows за project каде што не е member, без разлика на channel/table subscription.

### H.5 Notification Outbox flow

```text
1. Command примен → Action Engine креира notification_deliveries ред (status=pending)
2. Worker процесира ред → праќа кон provider (status=sent, provider_message_id)
3. Webhook/provider callback → status=delivered / opened / failed
4. Failed → retry (max 3) → потоа fallback: email + in_app banner
```

---

## I. AI JSON Schemas + Zod Types

### I.1 Provenance (корекција #12)

> **Никаде hard-coded „claude-sonnet-4-20250514“. Секој claim носи:** `provider`, `model_id`, `model_version`, `prompt_version`, `schema_version`.

```typescript
// ai_claims.claim payload
z.object({
  claimType: z.enum(['issue_detection', 'classification', 'summary', 'before_after']),
  confidence: z.number().min(0).max(1),
  provider: z.string(),
  modelId: z.string(),          // 'anthropic/claude-sonnet-4' (provider/model)
  modelVersion: z.string(),     // '20250514'
  promptVersion: z.string(),    // 'prompts/issue-detect/v3'
  schemaVersion: z.string(),    // 'claims/v1'
})
```

### I.2 Confidence thresholds (корекција #13)

| Claim type | Threshold | Потврда |
|---|---|---|
| `issue_detection` | ≥ 0.60 | AI може да предложи; човек одлучува |
| `severity` | ≥ 0.80 | AI предлага; PM/супервизор потврдува |
| `assignee` | ≥ 0.85 | AI предлага; PM потврдува |
| `before_after` | ≥ 0.90 | AI означува парови; човек верифицира |

> **Confidence ≠ probability of correctness.** Confidence е „колку AI е сигурен“ — НЕ „колку е веројатно точно“. Довербата секогаш оди преку human verification за workflow-impacting одлуки (корекција #13).

### I.3 Example claims

```jsonc
// issue_detection
{
  "claimType": "issue_detection",
  "claim": {
    "issue_type": "crack",
    "location_hint": "north wall, 2m from corner",
    "bounding_box": [12.3, 45.6, 78.9, 112.3],
    "severity_guess": "medium"
  },
  "confidence": 0.72,
  "provider": "anthropic",
  "modelId": "anthropic/claude-sonnet-4",
  "modelVersion": "20250514",
  "promptVersion": "prompts/issue-detect/v3",
  "schemaVersion": "claims/v1"
}

// before_after
{
  "claimType": "before_after",
  "claim": {
    "before_media_id": "m-before-1",
    "after_media_id": "m-after-1",
    "similarity_score": 0.93,
    "alignment": { "translation": [1.2, -0.4], "scale": 1.01 }
  },
  "confidence": 0.91,
  "provider": "openai",
  "modelId": "openai/gpt-4o",
  "modelVersion": "20240513",
  "promptVersion": "prompts/before-after/v2",
  "schemaVersion": "claims/v1"
}
```

### I.4 Human verification loop

```text
AI claim (confidence ≥ threshold) → прикажи во UI со confidence
→ Supervisor: „Прифати“ | „Одбиј“ | „Прилагоди“
→ ai_claims.human_verified = true, verified_by, verified_at
→ само verified claims влегуваат во извештаи/автоматски одлуки
```

> **AI никогаш сам не менува workflow state.** AI сугерира; човек одлучува (корекција #27: AI Claims → HUMAN CONFIRMATION).

---

## J. API Endpoint Contract

### J.1 Принципи

- Сите endpoint-и под `/v1/`, JWT auth, `Content-Type: application/json`.
- Сите command-и го следат контрактот од Дел C (expected_version + client_event_id + idempotency).
- Errors: RFC 7807 problem+json формат.
- Rate limiting: invitations (max_attempts, корекција #22), sync batch (100/event, backoff).

### J.2 Endpoint list

| Method | Path | Опис |
|---|---|---|
| `POST` | `/v1/sync/batch` | Sync batch (F.1/F.2) |
| `GET` | `/v1/aggregates/{id}/events?from_version=N` | Pull events за conflict resolution (F.4) |
| `POST` | `/v1/issues` | Create issue (IssueCreated event) |
| `POST` | `/v1/issues/{id}/acknowledge` | AcknowledgeIssue (D.2) |
| `POST` | `/v1/issues/{id}/start-work` | StartWork |
| `POST` | `/v1/issues/{id}/mark-fixed` | MarkFixed (guard: actor = assignee — не бара proof, корекција #7) |
| `POST` | `/v1/issues/{id}/verify-fix` | VerifyFix |
| `POST` | `/v1/issues/{id}/close` | CloseIssue |
| `POST` | `/v1/issues/{id}/reopen` | ReopenIssue (reason required) |
| `POST` | `/v1/issues/{id}/escalate` | Escalate (reason required) |
| `POST` | `/v1/issues/{id}/deescalate` | Deescalate (target state in body) |
| `POST` | `/v1/evidence` | EvidenceCaptured (media_upload_ids refs) |
| `POST` | `/v1/evidence/{id}/submit-proof` | SubmitProof (contract check) |
| `POST` | `/v1/evidence/{id}/verify` | VerifyEvidence |
| `POST` | `/v1/evidence/{id}/reject` | RejectProof (reason required) |
| `POST` | `/v1/evidence/{id}/accept` | AcceptProof |
| `GET` | `/v1/evidence/{id}/media` | Media list + signed URLs (Дел G) |
| `POST` | `/v1/media/upload-url` | createSignedUploadUrl (G.4) |
| `POST` | `/v1/ai/claims/{id}/verify` | Human verify AI claim (I.4) |
| `POST` | `/v1/invitations` | Create invitation (rate-limited, корекција #22) |
| `POST` | `/v1/invitations/{id}/accept` | Accept invitation (one-time, expiry check) |
| `GET` | `/v1/projects/{id}/feed` | Evidence feed (Realtime MVP via Postgres Changes) |
| `GET` | `/v1/notifications` | In-app notifications (notification_deliveries) |
| `POST` | `/v1/notifications/{id}/ack` | Acknowledge (opened) |

### J.3 Error format (RFC 7807)

```jsonc
{
  "type": "https://api.ceos.app/errors/conflict",
  "title": "Expected version mismatch",
  "status": 409,
  "detail": "Server version is 8, client expected 7",
  "instance": "/v1/issues/123/acknowledge",
  "errors": { "expected_version": ["server_version=8"] }
}
```

### J.4 Invitation security (корекција #22)

```jsonc
// POST /v1/invitations
{
  "organization_id": "org-1",
  "project_id": "p-1",
  "email": "worker@example.com",      // XOR email | phone
  "phone": null,
  "role": "field_worker",
  "expires_at": "2026-09-01T00:00:00Z"   // max 30 days
}
// Response: invitation_id + one-time code
// Guard: max_attempts (5), attempt_count++, rate-limited per org+email
// Accept: врзува auth.user + project_members, invalida code (one-time), revocation поддржана
```

---

## K. Test Matrix / Acceptance Criteria + Kill Criteria

### K.1 Test matrix (приоритети)

| ID | Area | Test | Accept criteria |
|---|---|---|---|
| T01 | Sync | Офлајн capture → online → sync | 100% events добиваат receipt; 0 дупликати |
| T02 | Sync | 2 уреди иста issue, различен expected_version | conflict receipt + човечка одлука без податочен loss |
| T03 | Sync | Retry после мрежен failure | exponential backoff, max 5, failed статус потоа |
| T04 | Sync | Idempotency (ист client_event_id двапати) | duplicate receipt, никаков side-effect |
| T05 | State | Секоја транзиција од D.2/D.3 со валиден guard | event + projection конзистентни |
| T06 | State | Invalid транзиција (пр. closed → fixed) | 409 + јасна грешка |
| T07 | Immutability | Event log replay од aggregate_heads | детерминистичка реконструкција на state |
| T08 | Immutability | Hash chain проверка | секој event hash = f(prev, payload); tamper detection |
| T09 | RLS | Worker се обидува да види туѓ проект | 403/empty (deny by default) |
| T10 | RLS | Worker се обидува verify-fix | 403 (само supervisor/PM) |
| T11 | RLS | `service_role` key во client | блокирано (никогаш client-side) |
| T12 | Media | Upload → processing → ready | variant lifecycle без overwrite на original |
| T13 | Media | Hash mismatch на upload | quarantined, никогаш delete |
| T14 | Notification | Assigned → delivered → opened | секој статус посебен event; delivery receipt |
| T15 | Notification | Failed push | fallback email + in_app |
| T16 | AI | Claim под threshold | не се прикажува како факт, само suggestion |
| T17 | AI | Human verify loop | verified_at/by пополнети; unverified ≠ во извештаи |
| T18 | Invitation | Expired / max_attempts / re-used code | сите блокирани |
| T19 | Performance | Sync batch 100 events | < 2s server round-trip (без media) |
| T20 | Performance | Realtime под 100 конкурентни сокети | Postgres Changes без throttling (корекција #13) |
| T21 | RLS | Project member гледа туѓ проект | 403/empty (is_project_member, корекција #2) |
| T22 | RLS | Организациски admin креира проект | успех (has_org_role, корекција #1) |
| T23 | RLS | Non-admin креира проект | 403 (само owner/admin) |
| T24 | Media | Upload на нерезервирана key | 403 (server-authorized signed URL, корекција #14) |
| T25 | Media | Orphan binary / pending media | reconciler audit + cleanup (никогаш delete) |
| T26 | Proof | fixed + missing proof | валидна состојба, VERIFY блокирано (корекција #7) |

### K.2 Kill criteria / go-no-go (корекција #24)

> **KPI-ите се target хипотези, НЕ факти (корекција #24):** секоја цел подолу се валидира против реални мерења во текот на 90-дневниот pilot. Baseline-и од други канали (на пр. „time-to-first-response на WhatsApp ~ 2h17" или „одговор ~ 8h24") се хипотези за споредба, не тврдени факти — се мери фактичката вредност на системот и се споредува, не се зема како готова вистина. Ако реалните мерења отстапуваат, целите се рекалибрираат со податоци, не со чувство.

**Continue (90 дена, gate на ден 45):**

```text
≥ 3 активни sites
≥ 60% weekly worker retention
≥ 80% capture success (фотографирана → evidence прифатена)
≥ 95% sync success (events добиваат receipt без human intervention)
≥ 50% issues со прифатлив proof
≥ 30% намалување на time-to-proof
```

**Pivot (ден 45 check):**

```text
Workers ја избегнуваат capture-фазата („преголем friction“)
Supervisors не верифицираат (proof не е actionable)
Evidence се чувствува burdensome, не „helps me close issues faster“
Sync не е надежен (повеќе конфликти од очекуваното)
Time-to-proof не се подобрува
```

**Kill feature (по 3 недели без traction):**

```text
Feature usage < 10% од активни workers → kill или redesign
```

### K.3 Definition of Done (за код генерација)

> **Инструкција за Gemini/Claude при генерирање код:** „Do not invent architecture. Implement this contract exactly.“

---

## Appendix: Корекции #1-#29 — Coverage Map

| # | Корекција | Каде е покриена |
|---|---|---|
| 1 | `public.profiles` + auth.users trigger, не `public.users` | A.3 |
| 2 | Bounded migrations по домен | A.1, A.2 |
| 3 | Client queue само во SQLite; server = ingestion+receipts | A.6, E.1-E.3, F |
| 4 | `sync_receipts` табела | A.6, F.2-F.3 |
| 5 | OCC, LWW само metadata | C.3, D.2, F.4 |
| 6 | Hash chain + aggregate_heads, serialized append | A.6, C.4 |
| 7 | `evidence_events.aggregate_version` | A.6, C.5 |
| 8 | ESCALATED return paths + VERIFIED→REOPENED | D.2 |
| 9 | Work ≠ Proof state | D.1, D.3, D.4 |
| 10 | `evidence_requirements` (runtime instance) | A.5, D.3 |
| 11 | Contract versioning (contract_versions) | A.5 |
| 12 | No hard-coded model name; provider/model/version/prompt/schema | A.6, I.1 |
| 13 | Per-type confidence thresholds; confidence ≠ probability | I.2 |
| 14 | Guided Re-Capture phased (V1 ghost overlay MVP) | G.3 |
| 15 | Mobile: Take Photo → Save first, action optional | G.4, (UX пренос од v2.1) |
| 16 | Notification outbox + delivery receipt | A.7, H |
| 17 | Realtime: MVP Postgres Changes, scale Broadcast | H.4 |
| 18 | Media lifecycle, original никогаш overwrite | A.4, G.1-G.2 |
| 19 | SQLite: schema/migration version, installation_id | E.1-E.2 |
| 20 | device_id ≠ trust anchor | A.4, B.1 |
| 21 | RLS матрица + authorization | B |
| 22 | Invitation security (expiry, max_attempts, one-time) | A.3, J.4 |
| 23 | Lightweight identity (без full account) | A.3 |
| 24 | Kill criteria / go-no-go | K.2 |
| 25 | Command → Event → Projection pipeline | C.1 |
| 26 | 4 logical layers (identity/ops/immutability/delivery) | A.2 |
| 27 | Final state machine (work + proof, escalated) | D.2, D.3 |
| 28 | Final product architecture diagram | 0.1 |
| 29 | Final assessment (9.3/10 target) | Section 0 таблица |