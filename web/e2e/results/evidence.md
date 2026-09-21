# T5 Step 4 — Frontend Static Spot Checks (F1–F12)

Date: 2026-08-11 — Method: static source inspection (no live DB required).
Each finding recorded as **[verified]** or **[adjusted]**. No app code modified (verification only).

---

## F1 · StatCard component shadowing (P2-7) — **[verified]**

Local `function StatCard` shadows the `ui/stat-card` primitive in both dashboards:

- `app/[locale]/dashboard/manager/page.tsx:16` — `function StatCard({ title, value, hint, tone })`
- `app/[locale]/dashboard/worker/page.tsx:16` — same local definition

Both components import `@/components/ui/stat-card`'s API surface but re-implement the markup locally.
**Evidence:** local function declarations at line 16 of both files; `ui/stat-card.tsx` exists as the intended primitive.
**Verdict:** reproduced exactly as claimed → **[verified]** (no prior fix; remains for the frontend backlog).

## F2/F3 · Duplicated fetch helpers (P2-8) — **[verified]**

Centralized client (`web/lib/supabase/queries.ts:24-65`) exposes `apiGet/apiPost/apiPatch/apiDelete`,
but dashboards bypass it with raw `fetch()`:

- `dashboard/manager/page.tsx:50` — `fetch('/api/defects?...')`
- `dashboard/manager/page.tsx:51` — `fetch('/api/attendance?limit=200')`
- `dashboard/manager/page.tsx:73` — additional raw fetch
- `dashboard/worker/page.tsx:48-51, 73` — raw fetches for `/api/photos` and siblings

(7 total raw-fetch call sites across the two dashboard pages + `work-orders/page.tsx`).
**Evidence:** grep for `fetch(` in both dashboard files vs `queries.ts` helper set.
**Verdict:** raw-fetch bypass of `queries.ts` confirmed → **[verified]**.

## F4/F5 · Duplicate `healthScoreFor` signatures / dead code (P3-12) — **[adjusted]**

Two functions named `healthScoreFor` with **different signatures** exist:

- `web/lib/health-tiers.ts:9` — `export function healthScoreFor(open: number, inProgress: number)`
- `web/lib/project-compare.ts:25` — `export function healthScoreFor(defects: Defect[])`

`project-compare.ts:3` imports health-tiers' version under alias `healthScoreFor as healthScoreFromCounts`.

**Both are actually used** (not dead): `ProjectHealthScore.tsx` imports from `health-tiers`;
`project-compare.test.ts:45-63` exercises both. `lib/__tests__/project-compare.test.ts` covers them.
**Verdict:** the "dead code" half is **[adjusted]** (no unused export found — imports resolved);
the duplicate-signature surface (F5, same name, different contracts) is **[verified]** and should be
renamed (e.g. `healthScoreFromCounts` as canonical name).

## F6 · Inconsistent data-access model (P3-9) — **[verified]**

Three patterns coexist with no single data-access layer:

1. Centralized helpers — `web/lib/supabase/queries.ts:24-65` (`apiGet/apiPost/apiPatch/apiDelete`)
2. Raw `fetch()` — dashboards (F2/F3), `work-orders/page.tsx:359` (see F11 hook)
3. Direct `supabase` client — `app/[locale]/pricing/page.tsx`, `projects/layout.tsx`,
   `projects/[id]/pins/page.tsx`, `dashboard/layout.tsx` (grep: `createClient|supabase\.`)

Plus typed hooks (`useWorkOrders`, `useLabels`, `useSubscription`) that duplicate cache/refetch logic (P4-8).
**Verdict:** mixed model confirmed → **[verified]**.

## F7 · 3 oversized page files (P3-8) — **[verified]** (path corrected)

- `web/app/[locale]/admin/labels/page.tsx` — **752 lines** ✓ (as claimed)
- schema page — **631 lines**, but actual path is `web/app/[locale]/projects/[id]/schema/page.tsx`
  (plan/review cited `app/[locale]/schema/page.tsx`; the file lives under `projects/[id]/`) — size claim ✓, path corrected
- `web/app/[locale]/work-orders/page.tsx` — **595 lines** ✓

All three exceed a 250-line ceiling.
**Verdict:** sizes reproduced → **[verified]**; path for the schema page **[adjusted]** to `projects/[id]/schema/page.tsx`.

## F8 · Orphaned `Label` types (P3-11) — **[adjusted]**

Only one `Label` type declaration exists in the current tree: `hooks/useLabels.ts:7`
(`export interface Label`). It is **actively used**:

- Imported by: `components/DailyLogTimeline.tsx`, `components/PhotoUpload.tsx`,
  `components/DefectBoard.tsx:5`, `components/DailyLogForm.tsx`, `components/labels/LabelPicker.tsx`
- 8 import sites, ~30 references total (grep confirmed)

**Verdict:** "declared but unused / imported from dead modules" **not reproduced** — the type is
live and wired into 5+ components. Any previously orphaned `Label` declaration has since been
removed or was never present in the current tree → **[adjusted]** (no dangling type surface found).

## F9 · Hardcoded Macedonian strings (P3-10) — **[adjusted]**

Count/location differ from the claimed "26 in components":

- `components/` (tsx): **0 files** contain Cyrillic literals → components layer is clean.
- App/pages with MK literals (**29 strings across 4 files**):
  - `app/[locale]/blog/page.tsx` — 2 MK tokens (случај, Студии)
  - `app/[locale]/case-studies/page.tsx` — 22 MK tokens (градежните, документација, заштитат, како, користат, нема, примери, работа, Реални, својата, случај, студии …)
  - `app/[locale]/projects/[id]/photos/page.tsx` — 4 MK tokens (бришење, Грешка …)
  - `app/[locale]/projects/[id]/page.tsx` — 1 MK token (Фотографија)

The blog/case-studies files are largely static content pages (may be intentionally authored in MK), but
`projects/[id]/photos` ("бришење" = delete, error strings) and `projects/[id]/page` ("Фотографија") are
**genuine UI strings** that should be localized.
**Verdict:** original location/count **[adjusted]** (components clean; 29 in 4 app pages instead of 26 in
components); the underlying i18n gap survives in app-layer UI strings (photos/projects pages) → still actionable.

## F10 · ESLint warnings (P4-1) — **[verified]** count, **[adjusted]** composition

`npx eslint app components lib hooks` (flat config `eslint.config.mjs`):
**22 problems, 0 errors, 22 warnings** — count matches the claim exactly.

Composition differs from the claim: **all 22 are `@next/next/no-img-element`** (raw `<img>` tags),
not unused vars/imports or `react-hooks/exhaustive-deps` (those are currently clean).
Sites: `PhotoCompare.tsx` (267, 275, 354, 383, 400), `PhotoUpload.tsx:158`, and others.
**Verdict:** count **[verified]** (22); composition **[adjusted]** (all no-img-element, not unused-vars).

## F11 · Test coverage gaps (P4-2) — **[verified]**

- `app/api/__tests__/` — **does not exist** → zero route-level tests (schemas, audit-logs, export, invite, webhooks all untested).
- `lib/__tests__/` present (7 files: attendance-insights, defect-aging, photo-calendar, project-compare,
  project-timeline, utils, weather-summary) — but no tests for: dashboard aggregates, `useWorkOrders`,
  invite limits, `escapeCsvField` edge cases.
- `useWorkOrders` hook exists (`hooks/useWorkOrders.ts`) and is used (`work-orders/page.tsx:6,359`) — untested.

**Verdict:** all claimed gaps confirmed → **[verified]**.

## F12 · `DefectBoard` N+1 queries (P4-3) — **[verified]**

- `components/DefectBoard.tsx:163,184` — per-defect sequential `fetch('/api/taggings?taggable_type=defect&taggable_id=…')` inside the render loop → N+1.
- `components/DefectBoard.tsx:53` **and** `:143` — `useLabels()` invoked twice (duplicate subscription).
- `components/DailyLogTimeline.tsx:42` — same per-item `/api/taggings` pattern for daily logs.

**Verdict:** N+1 + duplicate hook invocation reproduced → **[verified]**.

---

## Summary table

| F# | Finding | Verdict |
|----|---------|---------|
| F1 | StatCard shadowing (P2-7) | **[verified]** |
| F2/F3 | Duplicated fetch helpers (P2-8) | **[verified]** |
| F4 | Dead code (P3-12) | **[adjusted]** — no unused export; duplicate-signature half (F5) **[verified]** |
| F5 | Duplicate `healthScoreFor` signature | **[verified]** |
| F6 | Inconsistent data-access (P3-9) | **[verified]** |
| F7 | 3 oversized files (P3-8) | **[verified]** (schema page path corrected) |
| F8 | Orphaned `Label` types (P3-11) | **[adjusted]** — type is live, not orphaned |
| F9 | Hardcoded MK strings (P3-10) | **[adjusted]** — components clean; 29 in 4 app pages |
| F10 | ESLint warnings (P4-1) | count **[verified]** (22); composition **[adjusted]** (all no-img-element) |
| F11 | Test coverage gaps (P4-2) | **[verified]** |
| F12 | DefectBoard N+1 (P4-3) | **[verified]** |

**Note:** All findings are verification-only. Frontend backlog fixes remain untouched (planned as a separate
frontend workstream). Static checks do not require DB access; runtime E2E (T5 Steps 1–3) remains blocked on
local DB schema completeness.