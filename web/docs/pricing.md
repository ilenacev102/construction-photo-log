# Pricing & Plan Limits — Operating Guide

> Companion to **ADR-001** (`web/docs/adr/business-model.md`): the product is a
> Stripe **subscription** (SaaS). This document explains the plan structure,
> how to change prices, and how the plan/limit data is (currently) duplicated
> and how we plan to de-duplicate it.

## Plan structure

All prices are **USD, monthly**, billed via Stripe subscription checkout.

| Tier | Price | Projects | Photos | Users | Highlight |
| --- | --- | --- | --- | --- | --- |
| `free` | $0 | 5 | 500 | 1 | — |
| `crew` | $29 | 15 | 5,000 | 5 | — |
| `team` | $79 | 50 | 50,000 | 25 | ✓ (pricing page "Most Popular") |
| `company` | $199 | unlimited | unlimited | unlimited | Contact Sales (mailto) |

Feature flags per tier (QR attendance, defect tracking, drawing pins, audit
trail, API access, SSO, trade templates) are defined in the same place as the
numeric limits — see below.

## Single source of truth

**`web/lib/subscriptions/pricing.ts`** (`PLANS: Record<PlanTier, PlanConfig>`)
is the canonical definition of plans: display prices, `stripePriceId`
(driven by `STRIPE_PRICE_CREW/TEAM/COMPANY` env vars), feature bullet lists,
numeric limits (`projects`, `photos`, `users`, `tradeTemplates`), and feature
flags. It also exports helpers used by API routes:

- `getPlanConfig(plan)`, `getAllPlans()`, `getStripePriceId(plan)`
- `canCreateProject()` / `canUploadPhoto()` / `canInviteUser()` /
  `assertPlanLimit()` — used for app-layer checks.

## How to change prices or limits

> ⚠️ Because of the duplication described below, **a single change currently
> touches several files.** The "change" steps below list every place that must
> stay in sync until the cleanup plan (next section) lands.

### Change a price (e.g. crew $29 → $39)

1. **Stripe Dashboard** — create/update the monthly price for the plan's
   product and copy its `price_...` ID.
2. `web/.env.local` / env provider — set `STRIPE_PRICE_CREW=<new price_...>`.
3. `web/lib/subscriptions/pricing.ts` — update `priceCents` (and
   `displayPrice`) for the tier. **This is the source of truth.**
4. `web/app/[locale]/pricing/page.tsx` — the hardcoded `PLANS` array prices
   and the CTA copy in `web/messages/*.json` (feature strings) must be
   updated to match. **Track 2 will remove this once the page imports from
   `pricing.ts`.**
5. Stripe webhook → `resolvePlanFromPriceId()` maps the new price ID to the
   tier automatically (env-key prefix convention) — no code change.

### Change a limit (e.g. free photos 500 → 1000)

1. `web/lib/subscriptions/pricing.ts` — update `limits.photos` (and the
   `features` bullet). **Source of truth.**
2. `web/app/[locale]/pricing/page.tsx` — comparison table row (currently
   hardcoded `free: '500'`).
3. `supabase/migrations/20260801000001_enforce_plan_limits.sql` and
   `20260806000001_subscription_status_enforcement.sql` — the SQL `CASE`
   values in the `enforce_project_limit()` / `enforce_photo_limit()` triggers
   (`5/500, 15/5000, 50/50000`). Requires a new migration to change, e.g.:

   ```sql
   CREATE OR REPLACE FUNCTION public.enforce_photo_limit() ... -- update v_max CASE
   ```
4. `web/messages/*.json` — feature bullet copy ("500 photos").

### Change a feature flag (e.g. give crew defect tracking)

1. `web/lib/subscriptions/pricing.ts` — `limits.defectTracking`.
2. Pricing page comparison table + `web/messages/*.json` feature lists.

## Enforcement model

Two layers enforce limits; **both are required** and must stay in sync:

1. **App layer** — `web/lib/api/plan-limits.ts`:
   - `getUserPlan()` reads `plan` + `status` from `subscriptions` and returns
     the paid tier **only while `status ∈ {active, trialing}`**. A
     `past_due` / `canceled` / `unpaid` / `incomplete*` subscription degrades
     to `free` limits (ADR-001).
   - `requireProjectCreationLimit()` / `requirePhotoUploadLimit()` count
     scoped rows and throw a 403 (`LimitExceededError`) at the cap. Admins
     bypass.
   - Called from `app/api/projects/route.ts` and `app/api/upload/route.ts`.
2. **DB layer** — triggers `enforce_project_limit_trigger` /
   `enforce_photo_limit_trigger` (`supabase/migrations/20260801000001…` and
   `20260806000001…`) enforce the caps atomically (advisory-lock + count +
   insert), fixing the check-then-insert TOCTOU race. The status gate added in
   `20260806000001` mirrors `getUserPlan`.

Subscription lifecycle is maintained by the Stripe webhook
(`app/api/subscriptions/webhook/route.ts`): checkout → plan + status,
`subscription.updated` → tier/status changes (upgrades & downgrades),
`subscription.deleted` → `plan='free', status='canceled'`,
`invoice.paid` / `invoice.payment_failed` → `active` / `past_due`.

## The duplication problem (current state)

Plans and limits are defined in **3–4 places** that can drift:

| Source | What it holds | Authoritative? |
| --- | --- | --- |
| `web/lib/subscriptions/pricing.ts` | prices, limits, features, flags | ✅ canonical (TS) |
| `web/app/[locale]/pricing/page.tsx` | prices (local `PLANS`), limits (comparison table) | ❌ stale copy |
| `supabase/migrations/2026…_enforce_plan_limits.sql` + `20260806000001…` | numeric caps in SQL `CASE` | ❌ duplicated numbers |
| `web/messages/*.json` (`pricing.plans.*.features`) | feature bullet copy (i18n) | ❌ copy (owned by i18n/visuals) |

**Why it exists:** the DB trigger was written as a standalone atomic
enforcement layer (TOCTOU fix) and the pricing page predates `pricing.ts`; the
i18n copy is required by next-intl (UI strings cannot import TS).

## Cleanup plan (follow-up, not yet done)

1. **Pricing page** (Track 2, visuals): import `PLANS`/`getPlanConfig()` from
   `web/lib/subscriptions/pricing.ts` for the price display and derive the
   comparison table from `limits` instead of the hardcoded `PLANS` array and
   row literals. A `// TODO(visuals track)` marker is already on the page.
2. **DB trigger de-duplication** — generate the trigger bodies from
   `pricing.ts` instead of hand-maintained SQL:
   - Option A (recommended): a build-time or pre-commit generator
     (`scripts/gen-plan-triggers.mjs`) reads `PLANS` and emits the two
     `CREATE OR REPLACE FUNCTION` bodies; the migration is committed but
     regenerated when `pricing.ts` changes.
   - Option B: a SQL table `plan_limits(plan, projects, photos, users)` seeded
     by the app, and triggers `JOIN` it — moves the numbers into the DB but
     keeps two sources (TS + SQL seed) until the seed is generated from TS.
   - Decision: revisit when the pricing page import lands, so there is a single
     generator feeding both consumers.
3. **i18n feature copy** — keep as display-only; generation from `pricing.ts`
   features is possible but owned by the i18n/visuals tracks.

## Related

- ADR: `web/docs/adr/business-model.md`
- Schema: `supabase/migrations/20260725000010_create_subscriptions.sql`
- Trigger (original): `supabase/migrations/20260801000001_enforce_plan_limits.sql`
- Status enforcement: `supabase/migrations/20260806000001_subscription_status_enforcement.sql`
