# Construction Evidence OS — Product Strategy v2.0

> **Позиционирање:** Visual Site Evidence & Response OS — фотографијата е доказ, комуникација, локација и trigger за акција.
> **Датум:** 2026-08-19 · **Статус:** Draft · **Верзија:** 2.0
> **Наследено од:** `docs/PLAN-2026-08-19-nova-dimenzija.md` (истражување + анализа на топ 5 платформи)

---

## Дел 1 — Positioning

### 1.1 Што НЕ сме

- ❌ Не сме „нова градежна платформа“.
- ❌ Не сме „photo-first communication“ продукт. (Procore веќе има комуникација со фотографии во пораки, offline capture, searchable history, project workflows, map-based photos, before/after поддршка.)
- ❌ Не сме „photo gallery / report tool“.

### 1.2 Што сме

> **Visual Site Evidence & Response OS** — систем каде секоја field photo станува **структуриран, локациски врзан, следлив action record за помалку од 10 секунди.**

Вистинската конкурентска празнина не е „ние единствени испраќаме фотографија како порака“, туку:

> **„Ние го претвораме секој field photo во структуриран, локациски врзан, следлив action record за помалку од 10 секунди.“**

### 1.3 Product Thesis

> **A mobile-first construction evidence platform that turns jobsite photos into location-aware, accountable actions and verified proof of completion.**

### 1.4 Трите фундаментални слоја

```text
           CONSTRUCTION EVIDENCE OS

                 ┌──────────┐
                 │  CAPTURE │
                 └────┬─────┘
                      ↓
              ┌──────────────┐
              │   UNDERSTAND │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │     ACT      │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │    VERIFY    │
              └──────┬───────┘
                     ↓
              ┌──────────────┐
              │    PROOF     │
              └──────────────┘
```

### 1.5 Landing page пораки

- **„Turn Jobsite Photos Into Proof.“**
- „From Photo to Proof in 10 Seconds.“
- **„Capture. Assign. Prove.“** ← главната порака

### 1.6 Против кого се натпреваруваме

**Не се обидувај прво да го победиш Procore.**

Победи го:

> **„Ќе ја сликам и ќе ја пратам на WhatsApp.“**

А потоа од таа фотографија направи нешто што WhatsApp никогаш не може да го направи:

> **verified, location-aware, assigned, acknowledged, resolved construction evidence.**

### 1.7 Зошто ова е издржливо позиционирање

- Лидерите (OpenSpace, Raken, Procore) веќе туркаат AI voice и reporting — затоа нашата предност **НЕ е „ние имаме AI“**.
- Нашата предност е: **„Every AI claim has evidence behind it.“** — секоја AI изјава има доказ зад себе.
- Offline/sync и mobile reliability се **вистински оперативни проблеми** дури и кај големите платформи (Autodesk има повеќе официјални 2026 support случаи за photo upload/sync и mobile access; Procore експлицитно гради offline workflows) → **reliable field capture е core product, не secondary infrastructure**.

---

## Дел 2 — ICP (Ideal Customer Profile)

### 2.1 Првиот таргет

# Small / mid-sized specialty contractors

| Трговија | Примери |
|---|---|
| ⚡ | Electrical |
| ❄️ | HVAC |
| 🔧 | Plumbing |
| 🧱 | Concrete |
| 🏢 | Facade |
| 🏠 | Roofing |
| 🧱 | Drywall |
| 🚒 | Fire protection |

### 2.2 Зошто токму тие

Тие имаат:

- многу фотографии
- многу subcontractor coordination
- WhatsApp dependency (64–66% од екипите користат WhatsApp/IM како примарен канал)
- мал admin team
- малку време
- огромна потреба за **proof** (рекламации, инспекции, осигурителни)

И — критично — **не сакаат Procore complexity**.

### 2.3 Што значи тоа за продуктот

- Едноставност = #1 дизајн приоритет (Procore слабост: „тешко за учење и скапо“).
- Мобилната апликација е главниот производ, web е менаџерскиот слој.
- Субизведувачите мора да работат **без friction** — но со **identity** (види Дел 6.7).

---

## Дел 3 — Core Loop

### 3.1 CAPTURE → UNDERSTAND → ASSIGN → ACKNOWLEDGE → PROVE

Пример (целиот тек):

```text
Работник слика пукнатина
↓
системот автоматски зема time + GPS + project + zone
↓
работникот црта круг
↓
@Electrical Team
↓
„Fix by 16:00“
↓
одговорниот ја потврдува
↓
се бара After Photo
↓
AI прави Before/After proof
↓
issue се затвора
```

### 3.2 Workflow-от на доказ

```text
PHOTO
 ↓
ISSUE
 ↓
OWNER
 ↓
ACKNOWLEDGED
 ↓
FIX
 ↓
AFTER PHOTO
 ↓
VERIFIED
 ↓
CLOSED
```

### 3.3 Ова е производот

Имаш нешто многу посилно од photo diary. Имаш:

# Construction Evidence OS

Секој чекор во loop-от е **измеран KPI** (види Дел 7.6), секој чекор е **event во audit trail** (види Дел 6.6).

---

## Дел 4 — Feature Hierarchy

> Клучниот принцип: **не гради roadmap за цела компанија, гради roadmap за еден startup.**

### 4.1 CORE — мора да бидат совршени

| # | Feature |
|---|---|
| 1 | Camera |
| 2 | Offline |
| 3 | GPS/time |
| 4 | Annotation |
| 5 | Pin/location |
| 6 | Assignment |
| 7 | Notification |
| 8 | Acknowledgement |
| 9 | Before/After |
| 10 | Evidence report |

### 4.2 DIFFERENTIATOR — само овие три

| # | Feature | Зошто |
|---|---|---|
| 11 | **Same-viewpoint capture** | Moat кандидат — #1 диференцијатор |
| 12 | AI extraction | Invisible AI, зад сцена |
| 13 | Voice → structured evidence | Најбрзиот input, не иновацијата |

### 4.3 INTEGRATION LAYER — подоцна

| # | Feature |
|---|---|
| 14 | QR (Evidence Checkpoint) |
| 15 | Procore/Autodesk |
| 16 | WhatsApp |
| 17 | Webhooks |
| 18 | APIs |

### 4.4 EXPERIMENTAL — не ги планирај во core roadmap

**Не гради (Not Now):**

- native BLE
- NFC
- wearables
- live video
- drones
- photogrammetry
- IoT
- custom YOLO model
- SAM pipeline
- image-to-BIM
- full WhatsApp bot
- complex schedule engine

**Не затоа што не се добри. Туку затоа што не помагаат да се докаже core thesis.**

(Во v1.0 планот овие беа во roadmap; сега се експлицитно надвор од опсег — нивната вредност се препознава, но доаѓаат само откако Capture→Action→Proof loop-от е докажан.)

---

## Дел 5 — UX Flows

### 5.1 Evidence Inbox (Home screen за site manager)

Сите нови работи во еден inbox:

```text
🔴 4 urgent
🟠 12 awaiting acknowledgement
🔵 7 awaiting photo
🟢 18 verified
```

### 5.2 Evidence Feed (оперативен timeline, НЕ „Photo Gallery“)

```text
08:42  📸 Electrical issue
08:44  👤 Assigned to Marko
08:47  ✓ Acknowledged
10:13  📸 After photo
10:14  ✓ Verified
```

### 5.3 Guided Re-Capture (диференцијаторот, #1)

Првата фотографија станува **template**. Кога работникот повторно доаѓа:

```text
Previous photo
       ↓
camera opens
       ↓
transparent ghost overlay
       ↓
align viewpoint
       ↓
capture
       ↓
AI comparison
       ↓
"Wall completed"
"Pipe moved"
"Crack still visible"
"Tile installation 80%"
```

Визуелно:

```text
BEFORE                AFTER

     ███                  ███
    █   █                █   █
    █ X █       →        █ ✓ █
    █   █                █   █
```

**Зошто е moat кандидат:**
- AI reports може да ги копираат (Raken, BuildLog AI, Procore Daily Log Agent).
- Voice-to-text веќе постои (OpenSpace AI Voice Notes, Raken).
- Но **guided re-capture loop со AI компарација на телефонски фотографии** — никој не го има како phone-native продукт. (Истражувањето од v1.0 потврди: нема посветен продукт за ова со handheld phone photos.)

### 5.4 „Follow-up Photo Required“ / Required Evidence (killer feature)

Кога се креира issue:

> Fix required.

Системот автоматски создава **Required Evidence**:

```text
Issue #104
Electrical cabinet unfinished

Assigned: Electrician
Due: Today 16:00

Required:
☐ Completion photo
☐ Same-viewpoint photo
☐ Comment
```

Работникот не мора да отвора form. Само:

> **Take Photo → Done**

Системот разбира дека тоа е доказ за issue #104. **Ова го затвора целиот loop.**

### 5.5 Smart Site Checkpoint (QR, но брендиран)

Не „QR scanner“ — туку **Evidence Checkpoint**:

```text
ZONE B / LEVEL 3 / ELECTRICAL

[ QR ]

Scan
 ↓
Location verified ✓
 ↓
Worker verified ✓
 ↓
Capture required photo
 ↓
Timestamp ✓
 ↓
GPS ✓
 ↓
Checkpoint complete ✓
```

Менаџерска вредност: **Checkpoint completion rate: 92%**

### 5.6 AI Invisible

Работникот **не треба да мисли дека користи AI**:

```text
PHOTO
+
VOICE

↓

AI extraction

↓

Trade: Electrical
Location: Floor 3 / Zone B
Issue: Missing cable tray
Severity: Medium
Suggested assignee: Electrical subcontractor
Due: Tomorrow

↓

Human confirms
```

Ова е правилниот **Human-in-the-loop** модел.

### 5.7 Verified Photo (НЕ визуелен EXIF печат на секоја слика)

- **Original** — чиста фотографија (без визуелен печат што ја уништува).
- **Evidence metadata** — складирана, достапна:

```text
Captured:
19 Aug 2026 08:34:12

GPS:
42.00...

Project:
Tower A

Zone:
Level 3

Captured by:
Ile

Integrity:
Verified
```

- **Во PDF / export:** може да се избере **Evidence Stamp**.

„Verified Evidence“ е подобар marketing concept од „EXIF“ — клиентот не сака EXIF, сака **Proof**:

- Raw Photo → нормална слика
- Verified Photo → timestamp + location + project + author + capture integrity + chain of custody → **премиум feature**

### 5.8 Offline = „Works everywhere“ (Invisible)

Не продавај „Offline Mode“. Продавај **„Works everywhere.“** Работникот не треба да размислува дали има мрежа:

```text
TAKE PHOTO
   ↓
Saved ✓
   ↓
Uploading...
   ↓
Synced ✓
```

### 5.9 One-click Evidence Report (НЕ standalone „AI Daily Report“ модул)

> **Today's verified site activity**

AI го составува **само од verified events**:

```text
47 photos captured
12 issues
9 completed
3 unresolved
4 inspections
2 delayed items
```

И под секоја AI реченица:

> [View evidence]

Клик → директно на фотографијата. **Ова е much stronger trust model.**

---

## Дел 6 — Technical Architecture

### 6.1 Architecture Decision: Native рано

**Next.js web + React Native/Expo mobile** од релативно рана фаза.

#### Web (management layer)
- PM
- dashboards
- reports
- project management
- admin
- analytics
- AI review
- client portal

#### Native mobile (capture layer)
- camera
- offline queue
- background upload
- GPS
- push
- QR
- microphone
- local storage
- future BLE
- device capabilities

PWA е одлична како **rapid MVP**, но долгорочната визија има доволно device capabilities за **native да биде дел од архитектурата, а не „можеби некогаш“**.

### 6.2 Evidence Graph — централниот архитектурен концепт

Не само `Photo`. Туку `Evidence`:

```text
Evidence
├── Project
├── Location
├── Timestamp
├── GPS
├── User
├── Trade
├── Photo
├── Annotation
├── Voice Note
├── Issue
├── Assignee
├── Due Date
├── Status
├── Acknowledgement
├── Before Photo
├── After Photo
├── QR Checkpoint
├── AI Tags
└── Audit Trail
```

**Фотографијата престанува да биде „file“. Станува оперативен објект.** Ова е поважно од било која индивидуална AI функција.

### 6.3 Data model — предложен SQL (Supabase/Postgres)

```sql
-- Проект
projects (
  id uuid pk,
  name text,
  address text,
  client_name text,
  created_at timestamptz
)

-- Локации / зони на проектот (за pinning и QR checkpoints)
locations (
  id uuid pk,
  project_id uuid fk → projects,
  name text,              -- "Level 3 / Zone B"
  floor int,
  zone text,
  plan_url text,          -- optional: floor plan за pinning
  qr_code text unique     -- checkpoint код
)

-- Членови на тимот (вкл. subcontractors со ограничен scope)
team_members (
  id uuid pk,
  project_id uuid fk → projects,
  user_id uuid nullable,  -- null = magic-link only (без full account)
  role text,              -- 'manager' | 'worker' | 'subcontractor'
  trade text,             -- 'electrical' | 'hvac' | ...
  phone text,
  magic_link_token text nullable,
  magic_link_expiry timestamptz nullable,
  active bool default true
)

-- Evidence = оперативен објект
evidence (
  id uuid pk,
  project_id uuid fk → projects,
  location_id uuid nullable fk → locations,
  captured_by uuid fk → team_members,
  captured_at timestamptz,
  latitude numeric,
  longitude numeric,
  gps_accuracy numeric,
  trade text,              -- автоматски/АИ сугестиран
  photo_url text,          -- Supabase Storage
  thumbnail_url text,
  annotation jsonb,        -- {type:'circle', x,y,radius} или markup list
  voice_note_url text nullable,
  ai_tags jsonb,           -- {trade, severity, issue_type, suggested_assignee, suggested_due}
  ai_confirmed boolean default false,   -- human-in-the-loop
  -- Issue / Action
  issue_id uuid nullable fk → issues,
  status text default 'captured',  -- captured|assigned|acknowledged|fixed|verified|closed
  -- Before/After
  before_evidence_id uuid nullable, -- self-reference
  after_evidence_id uuid nullable,
  created_at timestamptz default now()
)

-- Issues (акциони записи)
issues (
  id uuid pk,
  project_id uuid fk → projects,
  evidence_id uuid fk → evidence,      -- оригиналната фотографија
  title text,
  severity text,                        -- low|medium|high|urgent
  assignee_id uuid fk → team_members,
  due_date timestamptz,
  acknowledged_at timestamptz nullable,
  acknowledged_by uuid nullable,
  fixed_at timestamptz nullable,
  verified_at timestamptz nullable,
  verified_by uuid nullable,
  status text default 'open',           -- open|acknowledged|fixed|verified|closed|escalated
  escalated_at timestamptz nullable,
  escalation_level int default 0
)

-- Аудитен траг (immutable)
evidence_events (
  id uuid pk,
  evidence_id uuid fk → evidence,
  issue_id uuid nullable,
  event_type text,      -- captured|annotated|assigned|acknowledged|photo_required|after_captured|verified|closed|escalated
  actor_id uuid fk → team_members,
  payload jsonb,        -- претходен/нов статус, метадата
  created_at timestamptz default now()
)
```

**Дизајн принципи:**
- Секоја промена на статус = `evidence_events` ред (immutable, append-only) → **chain of custody**.
- `status` транзиции се валидираат (не може `fixed` без `acknowledged`).
- AI секогаш пишува во `ai_*` полиња — **никогаш директно во оперативните полиња**; човек потврдува → `ai_confirmed = true` (промената станува официјална).

### 6.4 Offline engine = core product

- **Native:** SQLite локално складиште + WorkManager (Android) / BGTaskScheduler (iOS) за опортунистички sync; Wi-Fi-only upload; експоненцијален backoff; retry.
- **Дизајн:** ред (queue) на несинхронизирани evidence записи; конфликт-резолуција по `captured_at` + `device_id`; идемпотентност на upload (client-generated UUIDs).
- **UX:** „Saved ✓ → Uploading… → Synced ✓“ (5.8) — работникот никогаш не гледа грешка, само статус.
- **Зошто core:** Autodesk има повеќе официјални 2026 support случаи за photo upload/sync и mobile access; Procore експлицитно гради offline workflows → **reliable field capture е диференцирачка компетенција**.

### 6.5 AI слој — Invisible, зад сцена

**Архитектонско правило (од истражувањето v1.0):**
- **VLM (GPT-4o / Claude vision)** за јазичниот слој: екстракција (trade, issue, severity, assignee, due), тагирање, сумирање, Before/After опис.
- **YOLO/SAM 2** само за пикселни задачи (сегментација за мерења, counting) — и тоа само во подоцнежни фази.
- **Никогаш не гради свои модели.** За сегментација/мерење подоцна: SAM 2 (open source) како интеграција.
- **Human-in-the-loop:** AI пишува сугестии → човек потврдува → оперативен запис.

**Валидација на вредноста:** GPT-4V класифицира добро / локализира слабо (arXiv 2412.16108) → ветуваме **flag + сугестија**, никогаш „автоматско мерење“.

### 6.6 Event model / real-time

- **WebSockets** (Supabase Realtime) за live Evidence Feed и presence.
- **Push известувања** (FCM/APNs) како примарен канал + **SMS fallback** за работници без паметни телефони.
- **Ескалационен патерн:** тригер → рутирање по улога/сериозност → push+SMS → следи потврда (acknowledgement) → авто-ескалација при timeout → конверзија во формален запис.
- **Webhook out** (HMAC-SHA256) — подоцна, во Integration Layer.

### 6.7 Идентитет за subcontractors (без full account, со identity)

**без account ≠ без identity** — тоа е security problem.

```text
Secure magic link
+
phone verification
+
limited project scope
+
role
+
expiry
+
audit trail
```

Субизведувачот работи без full SaaS account, но **секоја акција има identity** (запишана во `team_members` + `evidence_events`).

### 6.8 Pricing: charge projects + intelligence, не по worker

Per-seat pricing го убива loop-от — продуктот бара многу луѓе да можат да **view → acknowledge → upload evidence**.

| Тиер | Цена | Вклучува |
|---|---|---|
| **Starter** | €29–49 / project / месец | Core loop, 1 project |
| **Team** | €99–149 / project / месец | + интеграции, повеќе проекти |
| **Pro** | €249–399 / project / месец | + AI, Verified Evidence, Checkpoints |
| **Enterprise** | custom | SSO, SLA, custom |

**Field viewers / subcontractors = free или речиси free.**

> # Charge for projects + intelligence, not every worker.

---

## Дел 7 — 90-Day Execution Plan

### 7.1 Фаза 0 — Foundation (Недела 1–2)

Security · RLS · CI · rate limiting · audit logs · storage architecture · **event model** (6.3)

> Ова е предуслов од аудитот (v1.0): нема rate limiting, нема web CI, дел од RLS/RPC прашања. Не прескокнувај.

### 7.2 Фаза 0.5 — Mobile Capture App (Недела 2–4)

**„Make capturing unbeatable.“** Само:

```text
Login
↓
Select project
↓
Camera
↓
GPS
↓
Annotation
↓
Offline Queue
↓
Sync
```

Web останува главниот management layer. После тоа постепено: QR → Voice → Push → Same-viewpoint.

**Главна метрика: Time-to-captured-evidence < 5 sec**

### 7.3 Фаза 1 — Capture Engine (Недела 4–6)

**„Make capturing unbeatable.“**

- native camera
- offline queue
- GPS
- timestamp
- compression
- retry
- background upload
- gallery
- fast project context

**Главна метрика: Time-to-captured-evidence < 5 sec**

### 7.4 Фаза 2 — Evidence Action (Недела 6–10)

**„Turn photos into work.“**

- annotate
- pin
- assign
- @mention
- severity
- due date
- push
- acknowledgement
- escalation

**Главна метрика: Photo → assigned action < 10 sec**

### 7.5 Фаза 3 — Close the Loop (Недела 10–13)

**„Prove the work was done.“** ← **најважната фаза**

- before/after
- guided re-capture
- required follow-up photo
- verification
- close issue
- audit trail

**Главна метрика: % issues closed with evidence**

### 7.6 Подоцнежни фази (по 90 дена)

| Фаза | Фокус | Метрика |
|---|---|---|
| **Фаза 4 — AI** | voice capture, photo understanding, auto-tagging, suggested assignee/severity, daily report, weekly summary | manual field entry reduced |
| **Фаза 5 — Site Intelligence** | QR checkpoints, geofencing, analytics, progress detection, repeated viewpoint history, project heatmap | evidence coverage |
| **Фаза 6 — Ecosystem** | Procore webhook/API, Autodesk, Teams, WhatsApp, external client links, API, camera integrations | integration adoptions |

> **WhatsApp не се гради уште.** Ако core UX не е подобра од „Take photo → send“, никакво WhatsApp integration нема да те спаси. Прво: „Take photo → action → proof“ побрзо од WhatsApp. Потоа: „WhatsApp → Evidence OS“.

### 7.7 Конкретни MVP screens

**Mobile (native, Фаза 0.5–2):**

1. **Login** — magic link / phone / email
2. **Project select** — брз контекст, последни проекти
3. **Camera capture** — големото копче, GPS/time печат, авто-проект/зона
4. **Annotation overlay** — круг/стрелка/белешка на фото
5. **Voice note** — држи-зборувај, прикачен на evidence
6. **Assignment sheet** — trade, @assignee, severity, due date (AI сугестии, human confirms)
7. **Evidence Inbox** — 🔴🟠🔵🟢 статусни групи
8. **Evidence Feed** — оперативен timeline
9. **Required Evidence prompt** — „Take Photo → Done“ за issue #104
10. **Guided Re-Capture** — ghost overlay + align + capture
11. **Sync status** — „Saved ✓ → Uploading… → Synced ✓“ (invisible offline)

**Web (management layer):**

1. **Dashboard** — Evidence Inbox агрегиран, KPI табла (7.8)
2. **Project detail** — Evidence Feed + мапа со pin-ови
3. **Evidence detail** — full metadata, chain of custody, before/after
4. **One-click Evidence Report** — AI извештај од verified events + [View evidence]
5. **Team & roles** — invite, subcontractor magic links
6. **Admin** — RLS, checkpoints, settings

### 7.8 KPI табла (НЕ „number of photos“)

| Категорија | KPI |
|---|---|
| **Capture** | Evidence captured / day |
| **Speed** | median capture time |
| **Action** | % photos converted to action |
| **Accountability** | acknowledgement rate |
| **Completion** | % issues closed with after evidence |
| **Adoption** | weekly active field workers |
| **Reliability** | offline sync success rate |
| **AI** | % AI suggestions accepted |
| **Business** | projects retained after 90 days |

### 7.9 Дали производот работи — пример на funnel

```text
100 photos

↓ 78 actionable

↓ 71 assigned

↓ 68 acknowledged

↓ 59 fixed

↓ 55 verified

= 55 verified evidence records
```

Ова е многу помоќен dashboard од: „Today 387 photos uploaded.“

### 7.10 Што се гради / што не се гради (експлицитно)

| ✅ Гради (CORE) | 🚫 Не гради (EXPERIMENTAL) |
|---|---|
| Camera | native BLE |
| Offline engine | NFC |
| GPS/time | wearables |
| Annotation | live video |
| Pin/location | drones |
| Assignment | photogrammetry |
| Notification | IoT |
| Acknowledgement | custom YOLO model |
| Before/After | SAM pipeline |
| Evidence report | image-to-BIM |
| Same-viewpoint (diff) | full WhatsApp bot |
| AI extraction (invisible) | complex schedule engine |
| Voice → structured evidence | |

---

## Прилог A — Моат: Structured Evidence Dataset

Не AI модел. Не QR. Не GPS. Не BLE. **Моат = структуриран evidence dataset.**

Со тек на време секој проект создава:

```text
Photo
→ location
→ trade
→ issue
→ action
→ worker
→ time
→ resolution
→ before/after
```

По илјадници проекти добиваш dataset кој овозможува:

- подобра класификација
- подобра препораки (assignee, severity, due)
- подобра progress detection
- подобра issue prediction
- подобра извештаи
- подобра benchmarking

**Тоа е вистинскиот long-term moat** — и токму затоа `Evidence` моделот (6.3) мора да е структуриран од ден 1: секоја фотографија ги носи своите структурирани метаподатоци низ целиот lifecycle.

---

## Прилог B — Одлуки донесени во v2.0 (наспроти v1.0)

| Тема | v1.0 | v2.0 |
|---|---|---|
| Позиционирање | „фото дневник + нови функции“ | **Visual Site Evidence & Response OS** |
| Натпревар | „никој нема photo-first communication“ | **„фото → структуриран action record < 10 сек“** |
| Same-viewpoint | Rank 3 | **#1 диференцијатор (Guided Re-Capture)** |
| Voice AI | главна иновација | **најбрзиот input, не иновацијата** |
| AI | голем централен модул | **AI Invisible, зад сцена** |
| Offline | функција | **core product („Works everywhere“)** |
| Architecture | Web → PWA → подоцна native | **Web + Native (React Native/Expo) рано** |
| QR | QR scanner | **Smart Site Checkpoint / Evidence Checkpoint** |
| EXIF | визуелен печат | **Verified Photo + опционален Evidence Stamp во PDF** |
| Pricing | отворено прашање | **per-project + intelligence; subcontractors free** |
| WhatsApp | рано | **Фаза 6, после докажан core loop** |
| Цел | „Construction Industry“ | **Small/mid specialty contractors** |
| Feature set | 30+ функции во roadmap | **10 CORE + 3 DIFFERENTIATOR, останатото надвор** |
| Централен концепт | Photo | **Evidence Graph** |
| Финален документ | план (vision) | **execution plan со KPI + funnel + 90-дневен план** |

---

## Прилог C — Структура на финалниот производ

```text
                    VISION

            CONSTRUCTION EVIDENCE OS
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       CAPTURE       ACTION       PROOF
          │            │            │
       PHOTO        ASSIGN       VERIFY
       GPS          PUSH         AFTER
       OFFLINE      ACK          AI
       VOICE        ESCALATE     REPORT
          │            │            │
          └────────────┼────────────┘
                       ↓
                 EVIDENCE GRAPH
                       ↓
               SITE INTELLIGENCE
```

---

*Извори и истражување: `docs/PLAN-2026-08-19-nova-dimenzija.md` (анализа на Procore, Autodesk Forma, Fieldwire, Raken, OpenSpace; live комуникација; хардверски можности; иновации). Клучни надворешни референци: Procore Conversations (procore.com/fc/communication), OpenSpace AI Voice Notes (support.openspace.ai), Raken Daily Reports (help.rakenapp.com), Autodesk Build Sync Troubleshooting (help.autodesk.com), Autodesk Photos access issue (autodesk.com/support).*
