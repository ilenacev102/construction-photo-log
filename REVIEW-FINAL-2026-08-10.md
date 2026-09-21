# Comprehensive Review — Final Report (RLS + API Authz + Stripe + DB Drift + Frontend)

**Date:** 2026-08-10
**Auditor:** Sisyphus (orchestration) — 3 explore agents (Phase 1) + 5 parallel review agents (Phase 2) + source verification (Phase 3)
**Target:** `/home/nac/Projects/construction-photo-log` — Next.js 16.3.0 + React 19.2.8 + Supabase + Stripe 22.3.2 + next-intl (5 locales)
**Method:** Hybrid. Findings cite `file:line`; claims marked **[verified]** were re-checked against source AND, for P0/P1-4/P3-7, empirically against a live system: local Supabase stack (`supabase start`, 12 containers healthy) + `supabase db reset` replay + read-only service-role REST probes against the remote project (`mqimwzcbhbzdpthjeqcj`). Remote DB introspection via psql remains blocked (`SUPABASE_DB_PASSWORD` not supplied; the provided `123` is the sudo password only and was rejected by the remote). Remote schema state therefore rests on REST probes + `supabase migration list --linked` + `REDTEAM-FIX-REPORT.md` §8.
**Baseline:** `tsc --noEmit` clean · `vitest run` 152/152 pass (19 files, ~7.9s) · `eslint` 0 errors / 22 warnings (all pre-existing `@next/next/no-img-element`, F10). **Evidence appendix:** `.omo/plans/evidence/2026-08-10-verification-evidence.md` (ledger T1.1–T9.9).
**Prior docs:** `REDTEAM-FIX-REPORT.md` (16 fixes, F-23 live-verified fixed), `AUDIT-FINAL.md`, `DB-AUDIT-VERIFIED.md`, `docs/feature-gaps-audit.md` (A1–A6, B1–B9).

---

## 1. Executive Summary

**2× P0 · 6× P1 · 8× P2 · 15× P3 · 10× P4** across five review domains. Two production-critical items stand out:

1. **P0 — `work_orders` is broken in production — [verified]:** the app (commit `5049e8f`) queries `work_orders`, but migrations `20260810000002` + `20260810000003` are **not applied to the remote DB** (empty Remote column in `supabase migration list --linked`). Live probe: `GET /rest/v1/work_orders?select=id` (service role) → **404** (table does not exist) → every `GET /api/work-orders` returns 500. **Remediation status (2026-08-11):** both untracked migrations (`20260810000001` + `20260810000003`) are now tracked in commit `8b0b5c2` (fresh-clone reproducibility restored); the remote **push is DONE and live-verified** (applied 2026-08-11 — table, trigger and all 3 policies present on remote; STOP-GATE 6 CLOSED).
2. **P0 — the migration chain is not replayable from scratch — [verified]:** `supabase db reset` (fresh local replay) **fails at `20260725000008_create_pins.sql:28`** — `ERROR: column photos.user_id does not exist (SQLSTATE 42703)` at statement 3 (`CREATE POLICY "Users view pins on their photos"`). Predicted later breakpoints (`20260725000011:8`, `20260725000014:117`) never run. The local DB is left with only 7 of 11 tables — partial schema is itself the proof. The remote only works because it was bootstrapped out-of-band (same root cause as F-23). **Decision — RESOLVED:** snapshot bootstrap (`db dump --linked` + `db restore`), documented in plan Task 3.5; no migration files edited.

The tenant model (`company-auth.ts` + RPC-gated admin writes) held up well across ~27 of 30 API routes. The highest-value **new** security finding is a **P1 storage signed-URL oracle** via `site_schemas.image_url` (cross-tenant read) — the same primitive class F-16 fixed on `photos`, left open on `site_schemas` **[verified]**.

**F-23 validated as FIXED on remote** (legacy role-based policies dropped; live probe 201→403 per `REDTEAM-FIX-REPORT.md` §8).

**Fixes applied during the hardening pass (2026-08-11, all TDD-verified):**
- **P2-4 [verified + fixed]** — labels/label_groups write routes now company-scoped via new `requireLabelGroupAccess` route-level re-check (commit `e52b5f4`, 14/14 route tests, full suite 152/152).
- **P2-1 [fixed — applied + live-verified]** — `stripe_events` RLS deny-all migration `20260811000001` applied to remote; live dump confirms RLS enabled with 0 policies (deny-all) — STOP-GATE 7 CLOSED.
- **P2-2 [fixed → refuted live → remediated]** — `daily_logs` write policies project-scoped migration `20260811000002` was applied but **ineffective on remote** (stale permissive policies survived — the DROPs targeted names that never existed in the remote's older migration revision); remediated via `20260812000001_remediate_stale_rls_policies.sql` (dropped 7 stale + created 4 missing owner-scoped projects policies) — **zero drift** verified.
- **P0-1 [fixed — applied + live-verified]** — untracked migrations tracked (`8b0b5c2`) AND `db push` executed; table + trigger + 3 policies live on remote — STOP-GATE 6 CLOSED.
- Earlier-pass fixes (shipped before this plan, still uncommitted at review time): P1-1 signed-URL oracle, P1-2 free-trial copy, P1-3 seat-limit wiring, P2-3 audit-logs null-ctx — regression-tested.

All verification evidence: `.omo/plans/evidence/2026-08-10-verification-evidence.md` (ledger T1.1–T9.9) + `web/e2e/results/evidence.md` (F1–F12).

---

## 2. Findings by Severity

### P0 — Critical

#### P0-1 · Work-orders migrations not applied to remote — production broken — **[verified]** → **[fixed]** — applied + live-verified on remote (STOP-GATE 6 CLOSED)
**Domains:** DB drift (C1/C2), RLS (N-8). **Status:** empirically verified (2026-08-10, live probes) → remediated (2026-08-11): migrations tracked, pushed, and live-verified. **Remediation status:** 2026-08-11 — the "untracked" half is FIXED (`8b0b5c2` tracked `20260810000001` + `20260810000003`); the "not applied to remote" half is FIXED — `supabase db push` executed and re-verified (zero drift).

- `supabase/migrations/20260810000002_work_orders.sql` — Remote column **empty** in `supabase migration list --linked` (2026-08-10). Not applied.
- `supabase/migrations/20260810000003_work_orders_assignee_guard.sql` — **was untracked**; now tracked in commit `8b0b5c2` (2026-08-11). Still **not applied** to remote.
- **Live proof:** `curl` service-role `GET {API_URL}/rest/v1/work_orders?select=id` → **HTTP 404** (`relation "work_orders" does not exist`). `photos?select=user_id` → 200 (column exists remotely), `audit_logs?select=ip_address` → 200 — confirming remote has drifted columns absent from tracked migrations (see P1-4/P3-7).
- Code already consumes the table: `web/app/api/work-orders/route.ts:20,47` (`admin.from('work_orders').select('*')`), `web/hooks/useWorkOrders.ts:10-18`, `web/app/[locale]/work-orders/page.tsx`. On remote this raises `relation "work_orders" does not exist` → 500 on every load.
- The migration itself carries `NOTE: Review before running. Apply with: supabase db push` (`20260810000002:9`) — committed and deployed without being pushed.
- **Also (status 2026-08-11):** `20260810000001_drop_legacy_role_based_policies.sql` (F-23 fix) **was applied-but-untracked** — now tracked in `8b0b5c2`; a fresh clone can now reconstruct remote truth (C3 closed).
- **Remediation (2026-08-11, STOP-GATE 6 CLOSED):** (1) ~~`git add` both untracked migrations~~ ✅ done in `8b0b5c2`; (2) ~~`supabase db push --dry-run`~~ ✅ done — clean, only the 2 expected pending migrations; (3) ~~`supabase db push`~~ ✅ **executed** — `20260810000001` + `20260810000003` applied to remote; (4) ~~verify~~ ✅ re-dump shows table + trigger + 3 policies live, `schema_migrations` clean, **zero drift**; (5) `migration repair` fallback — not needed.

#### P0-2 · Migration chain not replayable from scratch — **[verified]** — **RESOLVED** (snapshot bootstrap chosen, plan Task 3.5)
**Domain:** DB drift (B1). **Status:** empirically verified via local `supabase db reset` (2026-08-10). **Resolution:** user chose option (a) snapshot bootstrap — no migration files edited.

- **Live proof:** fresh replay stops at **`20260725000008_create_pins.sql:28`** — `ERROR: column photos.user_id does not exist (SQLSTATE 42703)`, "At statement: 3" (`CREATE POLICY "Users view pins on their photos" ON drawing_pins`). This is EARLIER than the previously predicted `20260725000011:8`; that breakpoint (and `20260725000014:117`) never run because replay aborts at statement 3.
- Root cause chain: `photos` created **without** `user_id` (`20260724000002_create_photos.sql`); `20260725000008:28` policy refs `photos.user_id = auth.uid()`; `20260725000011:8` `CREATE INDEX idx_photos_user_id ON photos(user_id)` refs it too; `20260730000002:3-4,15` documents the defect ("the photos table does not have a user_id column") but arrives too late in the chain to matter for replay.
- `CREATE POLICY` validates expressions at definition time — the policy cannot be created because the column doesn't exist yet.
- **Empirical side-effect:** after the failed reset, the local DB holds only 7 tables (projects, photos, profiles, trade_templates, attendance_logs, defects, daily_logs) — `drawing_pins`, `audit_logs`, `subscriptions`, `work_orders` never get created. Full output: `/tmp/opencode/p02-db-reset-evidence.txt`.
- **Decision — RESOLVED (user chose option a):** (a) **Snapshot bootstrap** — fresh DBs are built from `supabase db dump --linked` + `supabase db restore`, never `db reset`; documented in plan Task 3.5 with a CI gate asserting the chain-replay invariant. No migration files edited (history fidelity preserved). Option (b) in-place fix rejected by user.

### P1 — High

#### P1-1 · Storage signed-URL oracle via `site_schemas.image_url` (cross-tenant) — **[verified]** → **[fixed]** (earlier pass, regression-tested, uncommitted)
**Domain:** API authz. **Status:** 2026-08-11 — fix present in working tree (`web/app/api/schemas/route.ts` + `schema-pins/route.ts`), covered by `web/app/api/__tests__/schemas-route.test.ts` + `schema-pins-route.test.ts` (included in 152/152); not yet committed.
- `web/app/api/schemas/route.ts:55` — POST stores a **client-supplied** `imageUrl` verbatim (any string), gated only by `requireProjectMutate` (:51).
- `web/app/api/schemas/route.ts:28` — GET signs **every stored `image_url`** with `getSignedUrl(admin, ...)` — the server will sign any `storage/v1/object/...` path a tenant can get inserted.
- An authenticated user can POST `imageUrl: "storage/v1/object/public/other-company/proofs/x.jpg"` then GET it back signed, and read bytes of another company's storage — the same signing-oracle primitive F-16 fixed for `photos`, **left open on `site_schemas`**.
- **Fix:** whitelist `image_url` to the project's own bucket/path prefix (e.g. must start with `storage/v1/object/public/{companyId}/site-schemas/`), validate at POST time, and don't sign paths outside that prefix.

#### P1-2 · "Start Free Trial" misrepresents the product — **[verified]** → **[fixed]** (earlier pass, regression-tested, uncommitted)
**Domain:** Stripe/billing. **Status:** statically verified (2026-08-10, source re-check); fix present in working tree (`web/lib/subscriptions/pricing.ts`, locales), covered by `web/lib/__tests__/pricing-copy.test.ts`; not yet committed.
- `web/lib/subscriptions/stripe.ts:26-46` — checkout session created with `payment_mode: 'subscription'`, **no `trial_period_days`** (re-checked: `checkout.sessions.create` body at :27-44 has `mode: 'subscription'`, `line_items`, `subscription_data.metadata` — no trial field anywhere), first invoice due immediately.
- UI CTA says "Start Free Trial" (`web/messages/en.json:692,706`) → user is charged on day 0. Confirmed by product doc `docs/plans/2026-08-10-work-orders-design.md`.
- **Fix:** either add a real trial (`trial_period_days`), or change the CTA/copy to "Start 7-day Free Trial" only when a trial is configured; add the Stripe customer/trial fields first.

#### P1-3 · Seat limits (1/5/25) not enforced anywhere — **[verified]** → **[fixed]** (earlier pass, regression-tested, uncommitted)
**Domain:** Stripe/billing. **Status:** statically verified (2026-08-10, import graph); fix present in working tree (`web/lib/api/plan-limits.ts`, `web/app/api/invite/route.ts`), covered by `web/app/api/__tests__/invite-route.test.ts`; not yet committed.
- `web/lib/api/plan-limits.ts:29` defines limits `{ free: 1, pro: 5, company: 25 }`.
- `canInviteUser` (`web/lib/subscriptions/pricing.ts:172-175`) and `assertPlanLimit` (:188-196) are exported but have **zero imports** in the codebase (rg across `web/` — confirmed no `from '@/lib/subscriptions/pricing'` import sites for these symbols) — limits are dead code.
- Invites succeed regardless of plan → a free org can hold unlimited seats. No 402 / `stripe.subscription` status check on invite.
- **Fix:** wire `assertPlanLimit` into `web/app/api/invites/route.ts` (and `members` POST); return 402 when the limit is hit; add unit tests for the limit boundary.

#### P1-4 · `photos.user_id` phantom column → worker dashboard permanently empty — **[adjusted]**
**Domain:** DB drift. **Status:** adjusted by live probe (2026-08-10).
- **Live probe correction:** `GET /rest/v1/photos?select=user_id` (service role) → **200** — the column EXISTS on the current remote (bootstrapped out-of-band), so the remote does NOT 500 on the worker dashboard today.
- But the column is **absent from all tracked migrations** (fabricated in `20260725000011:8`; phantom refs in `20260725000008:28`, `20260725000014:117`) → **any fresh/CI/staging DB built from migrations lacks it** (and replay fails at P0-2 before the phantom refs even run). So the finding stands in form, corrected in mechanism: not "missing on remote" but "missing in migration-tracked schema → unreproducible on any fresh DB."
- `web/types/database.ts:20-21,281` still declares `photos.user_id`, `photos.updated_by`.
- `web/app/[locale]/dashboard/worker/page.tsx:113` — "My photos" filters on `user_id` → **always empty result set** on any migration-built DB (on the current remote it 200s but returns 0 rows since `user_id` is never written).
- **Fix:** pick one canonical owner column (recommend `created_by`, which exists) or add `user_id` deliberately via a real migration; update `types/database.ts`; fix the worker dashboard query.

### P2 — Medium

#### P2-1 · `stripe_events` has no RLS — **[verified]** → **[fixed]** → **[verified live]** (migration `20260811000001` applied to remote — STOP-GATE 7 CLOSED)
**Domain:** RLS (N-2). **Status:** 2026-08-11 — fix written, verified locally, **applied to remote and live-verified** (dump shows `ENABLE ROW LEVEL SECURITY` + 0 policies → deny-all active).
- Webhook handler writes rows (`web/app/api/subscriptions/webhook/route.ts` — note: the canonical path is under `app/api/subscriptions/webhook/`, NOT `app/api/webhooks/stripe/` as previously cited) but no RLS policies exist for `stripe_events`; direct read/write via anon/service-role key path is unguarded. Table should be service-role-only + webhook secret verification (which exists, :32 `constructWebhookEvent`).
- **T1.3 evidence:** `grep -c 'ENABLE ROW LEVEL'` on `supabase/migrations/20260729000002_stripe_events.sql` = **0**; zero `CREATE POLICY` referencing `stripe_events` in the entire migration chain (re-confirmed stats.dead_storage/ev billing scoped via service-role writes only). Verdict stands.
- **Fix (`20260811000001_rls_stripe_events_deny_all.sql`):** `ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY` + zero policies → deny-all for anon/authenticated (SELECT → 0 rows, writes → RLS violation). Webhook uses the service-role admin client (bypasses RLS) at both read (~:42) and write (~:218) sites, so the webhook path is unaffected. Idempotent (ENABLE is no-op when on). Evidence: appendix T7.1.

#### P2-2 · `daily_logs` write paths not project-scoped — **[adjusted]** → **[fixed]** → **[refuted live — ineffective]** → **[remediated + verified]** (STOP-GATE 7 CLOSED)
**Domain:** RLS (N-1). **Status:** 2026-08-11 — fix written and verified locally; applied to remote, then **live verification REFUTED it** (old permissive policies survived — see below); remediated via `20260812000001_remediate_stale_rls_policies.sql` → **zero drift**.
- **T1.3 correction of premise:** the REDTEAM claim "INSERT/UPDATE policies check `company_id`" is **not reproduced**. Local `pg_policies` + static chain show INSERT/UPDATE/DELETE on `daily_logs` use `WITH CHECK (auth.uid() = user_id)` / `USING (auth.uid() = user_id)` — **user-scoped, not company-scoped**. SELECT is upgraded to project-scoped in `supabase/migrations/20260731000001_fix_cross_tenant_rls.sql:289-296` ("Project members can view daily logs" USING `auth.uid() = user_id OR public.user_can_access_project(project_id)`).
- **Surviving concern (same severity class, different mechanism):** INSERT `WITH CHECK (auth.uid() = user_id)` does not validate `project_id` — an authenticated user can attach a log row to a `project_id` belonging to another company; row-level read/write of *their own rows* stays scoped, but cross-tenant **referential** writes remain possible.
- **Fix (`20260811000002_rls_daily_logs_project_write_access.sql`):** DROP+CREATE the three write policies — every one now requires `auth.uid() = user_id AND public.user_can_access_project(project_id)`. UPDATE gets the check in both USING (row lives in an accessible project) and WITH CHECK (target project accessible) — also stops "moving" a log between projects. DELETE project check added for defense-in-depth (logs are append-only; write access to a project should gate deletion). SELECT policy from `20260731000001` left untouched. Forward-only idempotent (`DROP POLICY IF EXISTS`). Evidence: appendix T7.2.
- **Live refutation (2026-08-11, appendix T9.4–T9.6):** remote was built from an OLDER migration-file revision — the old permissive policies ("Users insert/update/delete/view own daily logs", `auth.uid() = user_id` only) still existed, and `20260811000002`'s `DROP POLICY IF EXISTS` targeted the NEW names (never created on remote) → no-op, leaving both old and new policies present → permissive OR-semantics defeat the fix. Root cause confirmed: the stale policy names appear in **zero** local migration files (`git log --all -S'Projects creatable by authenticated'` → 0 hits).
- **Remediation (`20260812000001_remediate_stale_rls_policies.sql`, applied 2026-08-11):** dropped all 7 stale policies (3 role-based projects + 4 permissive daily_logs) and created the 4 missing owner-scoped projects policies (`20260724000001_create_projects.sql:12-26`). Re-verification: **zero drift** (remote 64 public + 4 storage = expected 68; 0 stale, 0 missing). Evidence: appendix T9.7–T9.9.

#### P2-3 · `audit-logs` GET — null-ctx cross-tenant read (IDOR) — **[verified]** → **[fixed]** (earlier pass, regression-tested, uncommitted)
**Domain:** API authz. **Status:** 2026-08-11 — fix present in working tree (`web/app/api/audit-logs/route.ts`), covered by `web/app/api/__tests__/audit-logs-route.test.ts`; not yet committed.
- `web/app/api/audit-logs/route.ts:43-45` — when `ctx` is null (site_manager without company), the filter is **skipped**, returning ALL `audit_logs` rows. `site_manager` has no company attached → full cross-tenant audit log dump.
- **Fix:** when ctx is null, filter to `company_id = ctx.company_id` — i.e. return empty/401; never fall through to unrestricted select.

#### P2-4 · `labels` write paths not company-scoped — **[adjusted]** → **[verified + fixed]** (route-level `requireLabelGroupAccess`, commit `e52b5f4`, 14/14 tests)
**Domain:** RLS/API authz. **Status:** 2026-08-11 — fixed via TDD, committed `e52b5f4`.
- `web/app/api/labels/route.ts` POST/PATCH/DELETE rely on policies checking `company_id` but the route doesn't re-check that the label's company matches the caller's `ctx.company_id` — a compromised/confused-role client can target labels in another company's row set where the policy uses `auth.uid()`-derived checks only. (Confirmed same class as P2-2.)
- **T1.3 evidence:** `supabase/migrations/20260730000001_create_labels.sql` — `labels`, `label_groups`, `taggings` ALL `ENABLE ROW LEVEL SECURITY` (lines 13/61/122/186); INSERT/UPDATE/DELETE policies (135/147/159) **are** company-scoped via `EXISTS (label_groups lg JOIN companies c ON lg.company_id = c.id JOIN profiles p ON p.company_name = c.name WHERE lg.id = group_id AND p.id = auth.uid())`. So the "not company-scoped at RLS layer" premise is **refuted** — the residual is defense-in-depth: the **route** should re-check `ctx.company_id` against the target label's group company.
- **Fix (commit `e52b5f4`):** new `requireLabelGroupAccess(db, userId, groupId)` in `web/lib/api/company-auth.ts` — resolves `ctx` via `getCompanyContext`, admin bypass; `!companyName` → 403 `'Немате пристап до групата на етикети.'`; `companies` lookup by `ctx.company_name` + `label_groups.company_id` compare → mismatch 403. Wired into `labels/items/route.ts` POST (typed `group_id`), `labels/items/[id]/route.ts` PATCH (select `'id, group_id'`) + DELETE (select `'group_id'`), `labels/groups/[id]/route.ts` PATCH/DELETE (existence check + check on `id`). RED → GREEN: `labels-routes.test.ts` 10 failed → **14/14**; full suite **152/152 (19 files)**; `tsc --noEmit` clean; `eslint` 0 errors. Evidence: appendix T6.1–T6.6.

#### P2-5 · Feature flags are declarative-only, never evaluated
**Domain:** Stripe/billing.
- `web/lib/subscriptions/pricing.ts` feature-flag map (`exports`, `ai`, `pdf`, `automations`, `unlimited_projects`) is never consumed; plan gates are not enforced client- or server-side.

#### P2-6 · `trialing` status grants full paid limits
**Domain:** Stripe/billing.
- Subscription status mapping treats `trialing` as paid; no `current_period_end`/cancel checks, so a canceled or trialing subscription keeps full Pro/Company limits.

#### P2-7 · Frontend: `StatCard` component shadowing (F1) — **[verified]**
**Domain:** Frontend. **Status:** verified by static spot check (2026-08-11, T5 Step 4 — `web/e2e/results/evidence.md`).
- Local `function StatCard` defined at `app/[locale]/dashboard/manager/page.tsx:16` AND `app/[locale]/dashboard/worker/page.tsx:16` — both shadow the `ui/stat-card` primitive — inconsistent visuals and future drift.

#### P2-8 · Frontend: duplicated fetch helpers (F2/F3) — **[verified]**
**Domain:** Frontend. **Status:** verified by static spot check (2026-08-11, T5 Step 4).
- Centralized client exists (`web/lib/supabase/queries.ts:24-65` — `apiGet/apiPost/apiPatch/apiDelete`), but dashboards bypass it: **7 raw `fetch()` call sites** across `dashboard/manager/page.tsx` (defects, attendance), `dashboard/worker/page.tsx` (photos, siblings) and `work-orders/page.tsx` — bypassing centralized error handling and auth headers.

### P3 — Medium/Low (hardening, correctness, UX)

#### P3-1 · `resolvePlanFromPriceId` fragile — webhook 400 → Stripe retry forever
**Domain:** Stripe/billing.
- `web/lib/subscriptions/stripe.ts` `resolvePlanFromPriceId` uses literal `price_...` strings; an unknown/misconfigured price id raises 400 to Stripe, which retries indefinitely and floods the webhook log. Should map to a config-driven table with a graceful no-op for unknown ids.

#### P3-2 · livemode gated on `NODE_ENV` — **[adjusted]**
**Domain:** Stripe/billing. **Status:** adjusted by source re-check (2026-08-10).
- **Correction:** `web/lib/subscriptions/stripe.ts` contains **no `NODE_ENV` reference** (re-checked :1-90). The original claim "Test/Prod mode chosen via `NODE_ENV !== 'production'`" is **not reproduced**. What actually exists: `getStripeServerClient()` (:4-8) constructs `new Stripe(process.env.STRIPE_SECRET_KEY!)` — livemode is determined implicitly by **which secret key** is set (`sk_test_…` vs `sk_live_…`), not by `NODE_ENV`.
- The underlying risk survives in weaker form: there is no explicit guard preventing a test key from being used in a production build (or vice-versa); mode detection is implicit on the key's prefix. Recommend an explicit env assertion (e.g. reject a `sk_test_` key when `NODE_ENV=production`), but the literal `NODE_ENV` mechanism is [adjusted].

#### P3-3 · Missing env vars → unhandled 500
**Domain:** Stripe/billing.
- Absent `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` throw at request time with no friendly error; should fail fast at boot with a clear message.

#### P3-4 · "Company" plan reachable via checkout (silent $199 path or 500)
**Domain:** Stripe/billing.
- Pricing page lists "Company"; checkout can create the session but the plan is not in the visible gate list → either silent $199 charge with no features, or 500.

#### P3-5 · CSV injection in export route
**Domain:** API authz.
- `web/app/api/export/route.ts:10-15` — `escapeCsvField` quotes only on `[",\n\r]`; leading `= + - @` cells pass through → formula injection when opened in Excel. Add `=`/`+`/`-`/`@` prefix escaping.

#### P3-6 · DB drift: stale migration duplicates in `web/supabase/migrations/`
**Domain:** DB drift (D2).
- `web/supabase/migrations/` holds a stale copy of the canonical `supabase/migrations/` set (drift since the dedupe). Confusing for anyone running migrations from the web dir. Remove dupes after confirming canonical dir is authoritative.

#### P3-7 · DB drift: `AuditLog.ip_address` declared in TS but missing in migrations — **[adjusted]**
**Domain:** DB drift (B4). **Status:** adjusted by live probe (2026-08-10).
- `web/types/database.ts:35` declares `ip_address`.
- **Live probe correction:** `GET /rest/v1/audit_logs?select=ip_address` (service role) → **200** — the column EXISTS on the current remote (bootstrapped out-of-band). The claim "remote column absent → any insert referencing it fails" is **not reproduced on the current remote**.
- What remains true: no **tracked migration** adds `ip_address`, so any fresh/CI/staging DB built from migrations lacks it (same out-of-band drift family as P1-4). **Adjusted:** from "absent on remote" to "absent in migration-tracked schema → unreproducible on fresh DBs." Add a real migration so fresh DBs match remote.

#### P3-8 · Frontend: 3 oversized page files (F7) — **[verified]** (path corrected)
**Domain:** Frontend. **Status:** verified by static spot check (2026-08-11, T5 Step 4).
- `web/app/[locale]/admin/labels/page.tsx` (752 lines ✓), `web/app/[locale]/work-orders/page.tsx` (595 ✓), schema page (**631** — actual path `web/app/[locale]/projects/[id]/schema/page.tsx`, not `app/[locale]/schema/page.tsx`). Extract sub-components/hooks; enforce a ~250-line ceiling.

#### P3-9 · Frontend: inconsistent data-access model (F6) — **[verified]**
**Domain:** Frontend. **Status:** verified by static spot check (2026-08-11, T5 Step 4).
- Three patterns coexist with no single layer: (1) `queries.ts` helpers, (2) raw `fetch` in dashboards/work-orders, (3) direct `supabase` client in `pricing/page.tsx`, `projects/layout.tsx`, `projects/[id]/pins/page.tsx`, `dashboard/layout.tsx`. Standardize on `queries.ts` + typed hooks.

#### P3-10 · Frontend: 26 hardcoded Macedonian strings (F9) — **[adjusted]**
**Domain:** Frontend. **Status:** adjusted by static spot check (2026-08-11, T5 Step 4).
- **Correction:** original claim was "26 MK strings in components" — components (`components/**/*.tsx`) are **clean (0)**. Residual: **29 MK literals across 4 app pages** — `blog/page.tsx` (случај, Студии), `case-studies/page.tsx` (22 tokens: градежните, документација, заштитат, како, користат, примери…), `projects/[id]/photos/page.tsx` (бришење, Грешка — genuine UI strings), `projects/[id]/page.tsx` (Фотографија). Blog/case-studies are largely static content pages (may be intentional MK content); the **projects photos/detail pages carry real UI strings** that must move to `next-intl` messages.

#### P3-11 · Frontend: orphaned `Label` types (F8) — **[adjusted]**
**Domain:** Frontend. **Status:** adjusted by static spot check (2026-08-11, T5 Step 4).
- **Correction:** only one `Label` declaration exists (`web/hooks/useLabels.ts:7` — `export interface Label`) and it is **actively used**: imported by `DailyLogTimeline.tsx`, `PhotoUpload.tsx`, `DefectBoard.tsx:5`, `DailyLogForm.tsx`, `labels/LabelPicker.tsx` (8 import sites, ~30 refs). The "declared but unused/imported from dead modules" claim is **not reproduced** — no dangling `Label` type surface found in the current tree. No action required.

#### P3-12 · Frontend: dead code (F4) / duplicate `healthScoreFor` (F5) — **[adjusted]**
**Domain:** Frontend. **Status:** adjusted by static spot check (2026-08-11, T5 Step 4).
- **Duplicate signatures confirmed:** `web/lib/health-tiers.ts:9` (`healthScoreFor(open, inProgress)`) vs `web/lib/project-compare.ts:25` (`healthScoreFor(defects: Defect[])`) — same name, different contracts; `project-compare.ts:3` aliases the count-based one as `healthScoreFromCounts`.
- **"Dead code" half adjusted:** both exports are actually used (`ProjectHealthScore.tsx` imports from `health-tiers`; `project-compare.test.ts:45-63` covers both) — no unused export found. The F5 duplicate-signature surface remains a refactor target (rename one to the canonical alias).

#### P3-13 · RLS: SECURITY DEFINER functions should be hardened (N-4..N-9) — **[adjusted]**
**Domain:** RLS.
- RPCs used by admin writes run `SECURITY DEFINER`; review `search_path`, `SET search_path` hygiene, and revoke PUBLIC EXECUTE where only authenticated app roles need them.
- **T1.3 evidence:** **all** SECURITY DEFINER functions across the entire migration chain already pin `search_path` — live local `pg_proc` shows 7 (http_get/http_post `search_path=net`, get_auth/handle_new_user/create_secret/update_secret `search_path=''`, http_request `search_path=supabase_functions`); static chain confirms `SET search_path` in `20260725000014`, `20260731000001`, `20260801000001..0003`. No unhardened `SECURITY DEFINER` found → downgraded to **[adjusted]** (verification-only; no code change required).

#### P3-14 · RLS: `storage.objects` — verify UPDATE/DELETE scoping — **[verified]**
**Domain:** RLS.
- Read scoping confirmed; confirm upload/delete policies are equally scoped per-company folder (not blanket authenticated).
- **T1.3 evidence:** live local `pg_policies` — storage.objects has exactly 3 policies: INSERT `WITH CHECK (bucket_id='construction-photos' AND auth.role()='authenticated')`, SELECT (no qual), DELETE; **no UPDATE policy** → updates denied by default. Migration `20260729000001_storage_security.sql` replaces these with project-aware policies (SELECT/INSERT/UPDATE via `user_can_access_project`) for remote. Scoping present in both states → **[verified]** (no change required; the per-company folder scope is enforced by the project-membership helper).

#### P3-15 · Webhook retry/no-idempotency on duplicate events
**Domain:** Stripe/billing.
- No idempotency key on event processing; duplicate `checkout.session.completed` can double-activate a subscription. Add event-id dedupe.

### P4 — Low (polish, DX, hygiene)

#### P4-1 · 22 ESLint warnings (F10) — **[verified]** count, **[adjusted]** composition
**Domain:** Frontend. **Status:** verified by static spot check (2026-08-11, T5 Step 4).
- `npx eslint app components lib hooks` → **22 problems / 0 errors / 22 warnings** — count matches.
- **Composition corrected:** all 22 are `@next/next/no-img-element` (raw `<img>` in `PhotoCompare.tsx:267,275,354,383,400`, `PhotoUpload.tsx:158`, others) — **not** unused vars/imports or `react-hooks/exhaustive-deps` (those are clean). Action: replace raw `<img>` with `next/image`; CI should treat warnings as errors.

#### P4-2 · Test coverage gaps (F11) — **[verified]** — partially closed (2026-08-11)
**Domain:** Frontend. **Status:** verified by static spot check (2026-08-11, T5 Step 4); partial remediation same day.
- `web/app/api/__tests__/` **did not exist** at review time — zero route-level tests (schemas, audit-logs, export, invite, webhooks untested). **Now exists (2026-08-11):** 5 files — `labels-routes.test.ts` (14 tests, P2-4), `audit-logs-route.test.ts` (P2-3), `invite-route.test.ts` (P1-3), `schema-pins-route.test.ts`, `schemas-route.test.ts` (P1-1) — full suite 152/152.
- `lib/__tests__/` present (7 files: attendance-insights, defect-aging, photo-calendar, project-compare, project-timeline, utils, weather-summary), but **no tests for**: dashboard aggregates, `useWorkOrders` (`web/hooks/useWorkOrders.ts` exists, used at `work-orders/page.tsx:6,359` — untested), invite limits, `escapeCsvField` edge cases. **Remaining gap:** export/`escapeCsvField` edge cases, dashboard aggregates, `useWorkOrders` hook.

#### P4-3 · `DefectBoard` N+1 queries (F12) — **[verified]**
**Domain:** Frontend. **Status:** verified by static spot check (2026-08-11, T5 Step 4).
- `web/components/DefectBoard.tsx:163,184` — per-defect sequential `fetch('/api/taggings?taggable_type=defect&taggable_id=…')` in the render loop → N+1.
- `useLabels()` invoked **twice** (`DefectBoard.tsx:53` and `:143`) — duplicate subscription.
- Same per-item `/api/taggings` pattern in `web/components/DailyLogTimeline.tsx:42` (daily logs). Batch with `IN (...)` or `Promise.all` at the data layer.

#### P4-4 · Stripe: missing unit tests for plan mapping
**Domain:** Stripe/billing. `resolvePlanFromPriceId` and status→limits mapping untested; the P1-2/P2-6 fixes should land with tests.

#### P4-5 · RLS: matrix not enforced by tests
**Domain:** RLS. No policy regression tests (e.g. `pgTAP` or a policy snapshot); the P0-2 replay failure and F-23 incident both trace to untested policy chains.

#### P4-6 · Migration count discrepancy — resolved: 32 canonical + 2 stale dupes
**Domain:** DB drift (D1). Verified against disk: canonical `supabase/migrations/` holds **32 files**; `web/supabase/migrations/` holds **2 stale dupes** (32+2=34 on disk; "38" matches nothing). Remove the 2 dupes (P3-6); update any doc claiming 38.

#### P4-7 · Fresh-clone reproducibility gap (C3) — **[verified]** → **[closed]** (commit `8b0b5c2`)
**Domain:** DB drift. Two migrations were applied-but-untracked (`...000001_drop_legacy_role_based_policies`, `...000003_work_orders_assignee_guard`) — a fresh clone could not reconstruct remote truth. **2026-08-11:** both now tracked in commit `8b0b5c2` → a fresh clone now reconstructs remote migration truth. Gap closed.

#### P4-8 · `useSubscription`/`useLabels` hook consistency
**Domain:** Frontend. Hooks duplicate cache/refetch logic; extract shared SWR/`useSWR`-style layer.

#### P4-9 · PDF/report generation bundle
**Domain:** Stripe/billing/frontend. `pdfkit` is `serverExternalPackages` — confirm it's never imported on the client; add a lint rule to enforce.

#### P4-10 · Accessibility/locale audit backlog
**Domain:** Frontend. 26 hardcoded strings (P3-10) block a11y + locale QA; the `docs/frontend-a11y-ux-audit.md` backlog should be wired to tickets.

---

## 3. Verified — No Finding (cleared areas)

- **ProjectQRCode / DrawingCanvas** — no authz/data-access defects (Frontend agent).
- **`health-tiers.ts`** — logic verified; only the duplicate signature (F5) flagged.
- **`ui/` primitives** — clean; only `StatCard` shadowing (F1) in pages.
- **`queries.ts` internals** — centralized helpers sound; the issue is bypass (F3), not the helpers themselves.
- **`labels/` components** — fine; the write-path scoping issue (P2-4) is at the API/RLS layer.
- **F-23 legacy role-based policies** — live-verified REMOVED (201→403) per REDTEAM-FIX-REPORT §8.
- **Webhook signature verification** — `constructWebhookEvent` at `web/app/api/subscriptions/webhook/route.ts:32` is correct (P3-15 is about idempotency, not signature).
- **Local stack runs** — `supabase start` brings up 12 healthy containers (db, studio, pg_meta, edge_runtime, storage, rest, realtime, inbucket, auth, kong, vector, analytics) on this machine (2026-08-10).
- **Remote is empty but reachable** — service-role REST probes against project `mqimwzcbhbzdpthjeqcj` succeed; every user table returns 0 rows (no production data at risk; P0-1's work_orders 404 is the only broken route).

## 4. Feature-Gaps Audit Cross-Check (docs/feature-gaps-audit.md)

| Gap | Status | Evidence |
|---|---|---|
| A1 (no work-orders in prod) | **CONFIRMED — P0-1 [verified]** | migration list empty Remote; live REST `work_orders?select=id` → 404 |
| A6 (billing plan mismatch) | **CONFIRMED — P1-2/P1-3/P3-4** | free-trial lie; limits dead code (zero imports — [verified]); Company reachable |
| A2/A3/A4 (remaining feature gaps) | Not re-audited this pass | see feature-gaps-audit.md |
| B1–B9 (worker/UX gaps) | Partially surfaced | P1-4 (My photos empty) aligns with B-series |

## 5. Remediation Checklist

| # | Action | Severity | Verification |
|---|---|---|---|
| 1 | ~~`git add` untracked migrations~~ ✅ DONE — commit `8b0b5c2` tracked `...000001_drop_legacy_role_based_policies`, `...000003_work_orders_assignee_guard` | P0-1 | `git status` clean for those files |
| 2 | ~~`supabase db push --dry-run`~~ ✅ DONE — clean, exactly 2 pending | P0-1 | **CLOSED (STOP-GATE 6)** |
| 3 | ~~`supabase db push`~~ ✅ DONE — `20260810000001` + `20260810000003` applied | P0-1 | **CLOSED — live-verified zero drift (STOP-GATE 6)** |
| 4 | If push blocked: `migration repair` + manual apply (high risk, may re-trigger F-23) | P0-1 | fallback, only if 2/3 blocked |
| 5 | P0-2: **RESOLVED — snapshot bootstrap chosen** (plan Task 3.5: `db dump --linked` + `db restore`; CI gate asserts chain-replay invariant; no migration edits) | P0-2 | fresh DBs built from snapshot, not `db reset` |
| 6 | P1-1: ~~whitelist `image_url` to project bucket prefix; validate at POST; don't sign foreign paths~~ ✅ DONE (earlier pass, regression-tested) | P1-1 | POST + GET schema w/ foreign path → 400/empty |
| 7 | P1-2: ~~add real trial or fix CTA copy~~ ✅ DONE (earlier pass, regression-tested) | P1-2 | checkout has `trial_period_days` or no "Free Trial" text |
| 8 | P1-3: ~~wire `assertPlanLimit` into invites/members; 402 on limit~~ ✅ DONE (earlier pass, regression-tested) | P1-3 | invite past limit → 402 |
| 9 | P1-4: decide `user_id` vs `created_by`; migrate + fix worker dashboard + types | P1-4 | worker dashboard shows photos |
| 10 | P2-3: ~~null-ctx → return 401/empty, never unrestricted select~~ ✅ DONE (earlier pass, regression-tested) | P2-3 | site_manager w/o company → no cross-tenant rows |
| 11 | P2-1/P2-2/P2-4: add RLS scope + route-level checks | P2 | P2-4 ✅ (commit `e52b5f4`, 14/14 tests); P2-1 ✅ applied + live-verified; P2-2 ✅ applied → refuted live → remediated (`20260812000001`) + live-verified — **CLOSED (STOP-GATE 7)** |
| 12 | P3-5: CSV formula-injection escaping | P3-5 | leading `=` cells quoted |
| 13 | P3-7: real migration for `audit_logs.ip_address` | P3-7 | column exists remotely |
| 14 | P3-1..P3-4, P2-5, P2-6: config-driven price map, env fast-fail, trialing gating | P3 | webhook 200 on unknown id; trialing = trial limits |
| 15 | P3-6/P4-6: reconcile migration dirs; delete stale dupes | P3-6 | one canonical dir |
| 16 | Frontend F1–F12 backlog (StatCard, fetch layer, oversize files, i18n, lint, tests) | P2/P3/P4 | tsc + vitest + eslint clean |

---

## Appendix A — Agent Domains & Evidence Base

- **RLS/tenancy** (agent A): per-table policy matrix; `projects` owner-only + company-access; `photos` SELECT/INSERT/DELETE (no UPDATE); `storage.objects` scoped; 34-migration sweep + REDTEAM-FIX-REPORT re-read.
- **API authz** (agent B): all `web/app/api/**/route.ts` traced; P1-1, P2-3, P3-5, P4-7 findings; webhook signature confirmed.
- **Stripe/billing** (agent C): checkout flow, plans, limits, webhook; no P0; P1-2/P1-3/P2-5/P2-6/P3-1..P3-4/P3-15.
- **DB drift** (agent D): full migration history vs types/database.ts vs route usage; P0-1/P0-2/P1-4/P3-6/P3-7/P4-6/P4-7; Project.trade REFUTED.
- **Frontend** (agent E): F1–F12 (12 findings), 3 cleared areas; no P0/P1.

## Appendix B — Method & Constraints

- Hybrid audit: review agents were read-only (no write/edit tools); orchestrator then performed **live verification** — local Supabase stack (`supabase start`, 12 containers), full `supabase db reset` replay (P0-2 empirical proof), read-only service-role REST probes against remote (`work_orders` 404; `photos.user_id` 200; `audit_logs.ip_address` 200; all tables 0 rows). Remote psql introspection blocked on `SUPABASE_DB_PASSWORD` (STOP-GATE 1; supplied `123` is the sudo password, rejected by remote).
- Orchestrator performed source verification for P1-1 (codegraph on `schemas/route.ts`), P1-2/P1-3/P3-2 (stripe.ts/pricing.ts source + import graph), P1-4/P3-7 (live REST + migration grep), P2-1 (webhook path correction), and both P0s (live replay + migration list + REST). This pass also added **T1.3 psql policy introspection** — local `pg_tables`/`pg_policies` matrix (26 policies across 7 public tables + storage.objects; all tables `rowsecurity=t`) plus a static sweep of the full migration chain for `ENABLE ROW LEVEL`, policy bodies, and `SECURITY DEFINER` hygiene — upgrading P2-1 **[verified]**, P2-2 **[adjusted]** (premise corrected: writes are `auth.uid()`-scoped, not company_id), P2-4 **[adjusted]** (RLS layer company-scoped; residual is route-level re-check), P3-13 **[adjusted]** (all SECURITY DEFINER already pin `search_path`), P3-14 **[verified]**. All such findings are marked **[verified]** or **[adjusted]** this pass; the remaining P2/P3/P4 items stay agent-reported with cited evidence.
- Companion docs: `AUDIT-FINAL.md`, `DB-AUDIT-VERIFIED.md`, `REDTEAM-FIX-REPORT.md`, `docs/feature-gaps-audit.md`, `docs/performance-audit.md`, `docs/frontend-a11y-ux-audit.md`, `docs/plans/2026-08-10-work-orders-design.md`.
