# SPEC — Construction Photo-Log: Risk Roadmap (v1)

> Decision-complete implementation specification. Derived from `the-fool` critical
> review of the revision plan, verified against the live codebase (Next.js 16.3 +
> React 19 + Supabase, 216 tests/29 files passing on Vitest 4.1.10).
>
> **Stack**: `web/` Next.js App Router, `supabase/migrations/` SQL, Vitest 4, date-fns 4.
> **Working dir**: `/home/nac/Projects/construction-photo-log/web`.
> **AGENTS.md rule**: this Next.js has breaking changes — subagents MUST read the
> relevant guide under `node_modules/next/dist/docs/` before writing Next.js code.

---

## Phase 1 — Correctness Foundation

### 1. Timezone model (canonical day semantics)

**Decisions (resolves the review's Challenge 1):**

1. **Storage stays UTC** everywhere (`timestamptz`). No column is re-typed.
2. **Canonical display/day-key timezone = `projects.timezone` (IANA)**, defaulting
   to `companies.timezone`, falling back to `'UTC'`. A single IANA string per project.
3. **Single canonical day-key helper** in `web/lib/time.ts` — ALL day bucketing goes
   through it. Kills the current 3-way split (UTC slice vs browser-local vs server-local).

   ```ts
   // web/lib/time.ts
   import { toZonedTime, format, fromZonedTime } from '@date-fns/tz'
   import type { Project, Company } from '@/types/database'

   export const DEFAULT_TZ = 'UTC'

   /** Resolve the IANA tz for a project: project -> company -> DEFAULT_TZ. */
   export function projectTz(project?: Pick<Project,'timezone'> | null,
                             company?: Pick<Company,'timezone'> | null): string

   /** Canonical day key (YYYY-MM-DD) of an ISO instant in the project tz. */
   export function dayKeyInTz(iso: string, tz: string): string

   /** "Today" (start-of-day ISO instant) in the project tz. */
   export function todayStartInTz(tz: string, now?: Date): Date

   /** Calendar-day arithmetic (DST-safe). Replaces all 24h DAY_MS math. */
   export function addDays(tz: string, date: Date, days: number): Date
   export function diffCalendarDays(tz: string, a: Date, b: Date): number
   ```

4. **DB migrations** (new file, e.g. `20260814XXXXXX_add_timezones.sql`):
   - `ALTER TABLE companies ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';`
   - `ALTER TABLE projects ADD COLUMN timezone text;` (nullable → resolves to company/UTC)
   - `ALTER TABLE daily_logs ALTER COLUMN log_date SET DEFAULT (CURRENT_DATE AT TIME ZONE 'UTC'::text)::date;`
     (reconcile DB-side "today" with UTC storage — `log_date` stays a `date`).
   - Add these columns to `web/types/database.ts` (`Project.timezone`, `Company.timezone`).
5. **Update all day-bucketing call sites** to use `dayKeyInTz` / `addDays` / `diffCalendarDays`
   instead of `toISOString().slice(0,10)` and `24*60*60*1000`:
   - `web/lib/photo-calendar.ts` (`toDayKey`, `buildCalendarGrid`)
   - `web/lib/attendance-insights.ts` (`dayKey`, `DAY_MS` bucket loop)
   - `web/lib/defect-aging.ts` (`DAY_MS` → `diffCalendarDays`)
   - `web/lib/project-compare.ts` (`DAY_MS` cutoff)
   - `web/lib/project-timeline.ts` (UTC day slices)
   - `web/hooks/useAttendance.ts` (`today` computation → project tz)
   - `web/app/api/attendance/route.ts` (`today=true` filter → project tz)
6. **Add `@date-fns/tz`** to `web/package.json` dependencies (verified absent).
7. **Tests**: `web/lib/__tests__/time.test.ts` — DST transitions (Europe/Skopje, America/New_York),
   day-key correctness across UTC, project-tz override, company fallback. Existing `photo-calendar.test.ts`
   must still pass (update to inject tz where needed).

### 2. Attendance invariants (resolves Challenge 5)

**Decisions:**
1. Invariant is **one active check-in per (user, project)** — NOT "business day".
   Construction works weekends; "calendar day" would wrongly block a second shift. Use
   a **partial unique index** on the active (open) row.
2. New migration (append to the timezone migration file or separate `..._attendance_invariants.sql`):
   ```sql
   -- one open check-in per (user, project)
   CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_one_open_per_user_project
     ON attendance_logs (user_id, project_id) WHERE check_out IS NULL;

   -- no negative/zero durations, hard cap (e.g. 24h)
   ALTER TABLE attendance_logs
     DROP CONSTRAINT IF EXISTS attendance_duration_sane;
   ALTER TABLE attendance_logs
     ADD CONSTRAINT attendance_duration_sane
       CHECK (check_out IS NULL OR check_out > check_in);
   -- cap via a BEFORE INSERT/UPDATE trigger: reject check_out - check_in > interval '24 hours'
   ```
3. **Ownership on check-out**: `web/app/api/attendance/route.ts` `checkOut` currently uses
   `requireProjectMutate` (project-level) — add explicit `existing.user_id === user.id` check.
   Defense-in-depth: RLS `"Users update own check-out"` already scopes to `auth.uid()=user_id`,
   keep it. The admin-client bypass must be closed in the handler.
4. **UI live elapsed**: `web/components/...` showing `'--'` for active logs — compute elapsed
   in project tz (no change required beyond using `dayKeyInTz` if bucketing).
5. **Tests**: migration correctness (partial unique index rejects a 2nd open row, allows
   closed rows); route ownership (user A cannot check out user B's log).

---

## Phase 2 — Risk Intelligence

### 3. Explainable risk score (resolves Challenge 2 + 4)

**Decisions:**
1. Replace `healthScoreFor` (counts-only) with an explainable 0–100 `riskScore`.
   **Pure function** in `web/lib/risk-score.ts` — no I/O, fully testable.
2. **Three dimensions, each normalized 0–100**, aggregated by **weighted sum**:
   - `quality` — from open/in-progress defects, **severity-weighted** (low=1, medium=2,
     high=4, critical=8) with **age** (open days, DST-correct via `diffCalendarDays`) and
     **lateness** (past `due_date`). Range 0..100.
   - `delivery` — from **overdue work orders** (status != done/cancelled AND due_date < today)
     and **overdue defects** (due_date < today). Milestone slip only after milestones exist.
     Range 0..100.
   - `evidence` — from **stale documentation**: days since last photo / daily log / attendance
     in the project tz, relative to a window (e.g. 7 days). Range 0..100.
3. **Weights** (configurable constants): `quality 0.5, delivery 0.3, evidence 0.2`.
   `riskScore = round(quality*wQ + delivery*wD + evidence*wE)`, clamped `[0,100]`.
   (Higher = riskier. Tier mapping: `<=25 low, <=55 medium, <=80 high, else critical`.)
4. **Explainability** — each result carries `signals[]`:
   ```ts
   interface RiskSignal { reason: string; value: number; threshold: number; action: string }
   interface RiskScoreResult {
     score: number; tier: RiskTier;
     quality: number; delivery: number; evidence: number;
     confidence: 'high' | 'medium' | 'low';   // data recency + coverage
     signals: RiskSignal[];
   }
   ```
5. **`confidence`** defined concretely: `low` if < 3 evidence-days in window OR no defects
   AND no work orders; `high` if >= 5 evidence-days AND >= 1 defect or work order; else `medium`.
6. **Consume** — update `web/lib/health-tiers.ts` / `web/lib/project-compare.ts` / `ProjectHealthScore.tsx`
   to surface `riskScore` + signals (tier pill + tooltip listing signals). Keep a **backward-compat
   `healthScoreFor(open,inProgress)`** alias if other consumers need it, or migrate all 6 consumers.
   Update `project-compare.test.ts` (currently asserts old `100-16-4` values).
7. **Tests** — `web/lib/__tests__/risk-score.test.ts`:
   - **Determinism**: same input → same score.
   - **Bounds**: score always `[0,100]`.
   - **Monotonicity**: worsening a dimension (more open criticals, later overdue) never lowers risk.
   - **Worked examples**: documented scenarios with exact expected scores.

### 4. Server-side analytics contract (resolves "no analytics endpoint")

**Decisions:**
1. Extend the **per-project** analytics surface. `/api/stats` stays (global admin counts).
   Add **`GET /api/projects/[id]/analytics`** returning the typed contract:
   ```ts
   interface ProjectAnalyticsResponse {
     projectId: string;
     risk: RiskScoreResult;
     summary: {
       photoCount: number; activeDays: number; openDefects: number;
       inProgressDefects: number; resolvedDefects: number;
       openWorkOrders: number; overdueWorkOrders: number;
       photosLast30Days: number; firstPhotoDate: string | null; lastPhotoDate: string | null;
     };
   }
   ```
2. **Role-scoped**: reuse `requireProjectAccess`/`getAccessibleProjectIds`; manager role
   (`site_manager|admin`) for the full contract; field/read roles get a reduced read view.
   Follow the `web/app/api/attendance/route.ts` + `company-auth.ts` guard pattern.
3. **Consume**: point the 6 dashboard consumers at this endpoint where they currently
   re-compute client-side; keep the pure `computeProjectStats` for tests.
4. **Next.js**: read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
   before writing the route handler (breaking changes in this Next version).

---

## Phase 3 — Milestones (after risk v1 lands; not in this first wave)

- New `milestones` table (`project_id`, `title`, `due_date`, `status`, `sort_order`),
  manager-only CRUD, optional. `delivery` dimension later consumes milestone slip.
- Not implemented in the first parallel wave (kept as a follow-up unit).

---

## Execution order (parallel-safe units)

| Unit | Files | Depends on |
|---|---|---|
| **A. Timezone** | `lib/time.ts` (new), migrations, `types/database.ts`, `photo-calendar.ts`, `attendance-insights.ts`, `defect-aging.ts`, `project-compare.ts`, `project-timeline.ts`, `useAttendance.ts`, attendance route, `package.json`, tests | — |
| **B. Attendance invariants** | migration, attendance route ownership, tests | — (independent of A) |
| **C. Risk score engine** | `lib/risk-score.ts` (new), `health-tiers.ts`, `ProjectHealthScore.tsx`, consumers, `risk-score.test.ts`, `project-compare.test.ts` | — (pure fn; consumes time helper for age) |
| **D. Analytics contract** | `app/api/projects/[id]/analytics/route.ts` (new), consumers | C (returns RiskScoreResult) |

> Units A, B, C are fully independent → run **in parallel**. Unit D depends on C's types
> (import `RiskScoreResult`), so it runs after C's API is defined — but D can be written
> against the declared contract in parallel and integrated after. To keep correctness,
> dispatch A+B+C in parallel first, then D.

---

## Verification gates (before declaring any unit done)

- `npm run test` (vitest) — all pass, count grows.
- `npm run type-check` (tsc --noEmit) — clean.
- `npm run lint` — clean.
- Subagent MUST read Next.js docs guide before route-handler work (AGENTS.md rule).