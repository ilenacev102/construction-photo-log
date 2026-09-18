# ADR-001: Business model — ready-made product vs SaaS subscription

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **Deciders** | Product / engineering (Track 5 of the parallel business-model effort) |
| **Scope** | Monetization model for Фото Градежен Дневник (Photo Construction Log) |
| **Supersedes** | — (first ADR on this topic) |

## TL;DR

**Recommendation: Subscription (SaaS) — keep and harden the existing Stripe
subscription stack.** The one-time-product path would require deleting working
billing infrastructure and contradicts the product's recurring value for
construction firms. This ADR grounds the decision in what is actually built
today and lists the changes needed to make the subscription model correct.

---

## Status

Accepted. The engineering work that follows (status-based plan enforcement,
single source of truth for pricing) is scoped to the subscription path. The
one-time-product alternative is rejected but documented in [Alternatives](#alternatives).

---

## Context

### What exists in the codebase today (verified facts)

The repo already contains a **full, working Stripe subscription stack**:

1. **`subscriptions` table** (`supabase/migrations/20260725000010_create_subscriptions.sql`)
   - Columns: `plan plan_tier NOT NULL DEFAULT 'free'`, `status text NOT NULL
     DEFAULT 'active'`, `stripe_customer_id`, `stripe_subscription_id`,
     `current_period_start/end`, `cancel_at_period_end`.
   - A `handle_new_subscription()` trigger auto-creates a **free** row for every
     new `auth.users` row, so every user already "has a subscription".
   - `plan_tier` enum: `free | crew | team | company`.

2. **Stripe checkout, portal, and webhook** (`web/app/api/subscriptions/{checkout,portal,webhook}/route.ts` + `web/lib/subscriptions/stripe.ts`)
   - `createCheckoutSession()` uses `mode: 'subscription'` (hardcoded) with a
     single monthly price per plan.
   - Monthly price IDs come from `STRIPE_PRICE_CREW / STRIPE_PRICE_TEAM /
     STRIPE_PRICE_COMPANY` env vars; `resolvePlanFromPriceId()` maps a price ID
     back to a plan tier (env-key prefix convention).
   - The webhook handles the full lifecycle: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.paid`, `invoice.payment_failed` — it maintains `plan` and
     `status` on the `subscriptions` row, with stale-event protection
     (`stripe_event_created`) and idempotency via the `stripe_events` table.

3. **Plan catalog and limits** (`web/lib/subscriptions/pricing.ts`)
   - Plans: **free $0 / crew $29 / team $79 / company $199**, all monthly.
   - `PLANS[].limits` (projects / photos / users / feature flags) is the
     closest thing to a single source of truth in TypeScript.

4. **Three-way duplication of plans/limits** (the core architectural smell)
   - (a) `web/lib/subscriptions/pricing.ts` — canonical plan config in TS.
   - (b) `web/app/[locale]/pricing/page.tsx` — hardcodes prices in a local
     `PLANS` array (lines 26–55) **and** re-hardcodes the limits in the
     comparison table (lines 211–223).
   - (c) `supabase/migrations/20260801000001_enforce_plan_limits.sql` —
     DB triggers `enforce_project_limit()` / `enforce_photo_limit()` hardcode
     the caps (`free=5/500, crew=15/5000, team=50/50000, company=∞`) in SQL
     `CASE` statements.
   - There is also a fourth copy of the *feature bullet lists* in the i18n
     messages files (`web/messages/*.json` → `pricing.plans.*.features`), which
     repeat the same numbers ("5 projects", "500 photos", …).

5. **Enforcement gap** (the main correctness bug)
   - `getUserPlan()` (`web/lib/api/plan-limits.ts`) returns `data?.plan ?? 'free'`
     **without checking `subscriptions.status`**. A subscriber whose invoice
     failed (`status='past_due'`) or whose subscription was cancelled keeps the
     paid tier's limits.
   - The DB triggers have the same gap: they read `plan` with no `status`
     filter, so a `past_due` user is still capped by their paid tier at the
     database layer.
   - `mode: 'subscription'` is hardcoded in `createCheckoutSession()`.

6. **Trial inconsistency**
   - The pricing page CTAs say **"Start Free Trial"** (`web/messages/*.json`
     → `pricing.plans.crew.cta` / `team.cta`), but
     `createCheckoutSession()` passes **no `trial_period_days`** and no
     `subscription_data.trial_settings`. The trial is promised but not
     implemented.

### Sales goal

The product's buyers are **construction firms** (crew/team/company tiers map to
company sizes; the pricing page targets "small construction teams" and "growing
construction companies"). Construction photo documentation is a **continuous
operational activity** — daily logs, attendance, audit trails, and photos accrue
throughout a project's lifecycle — which maps naturally to recurring billing.

---

## Decision

**Adopt the subscription (SaaS) model and keep the existing Stripe stack.**

Concretely:

1. **Stay on Stripe `mode: 'subscription'`**, the `subscriptions` table, the
   billing portal, and the lifecycle webhook. This is the platform that is
   already built and deployed; abandoning it would discard working code with no
   offsetting gain.
2. **Fix the enforcement gap** (this track): honor a paid plan only while the
   subscription is `active` or `trialing`; degrade to free limits on
   `past_due` / `canceled` / `unpaid` / `incomplete*`.
3. **Make `web/lib/subscriptions/pricing.ts` the single source of truth** for
   plan definitions, prices, and limits; wire the pricing page and the DB
   layer to it (DB layer de-duplication is a documented follow-up — see
   `web/docs/pricing.md`).
4. **Implement the advertised trial** (recommended next step, business-owned):
   add `trial_period_days` to checkout for crew/team, keep the Company tier on
   "Contact Sales" (custom/negotiated pricing).
5. **Keep the Company tier sales-led** (`mailto:` on the pricing page). Custom
   contracts are the norm for the top tier of construction-software
   subscriptions and do not require a separate business model.

### What must change for this path

| # | Change | Owner / track | Status |
| --- | --- | --- | --- |
| 1 | `getUserPlan()` gates paid plans on `status ∈ {active, trialing}` | This track | ✅ done (2026-08-06) |
| 2 | Webhook records the real Stripe status (incl. trialing) and sets `canceled` on deletion | This track | ✅ done (2026-08-06) |
| 3 | DB triggers get the same status gate + status index | This track | 🟡 migration written, not yet pushed |
| 4 | Pricing page imports plans/limits from `pricing.ts` (TODO comment placed; visual restructure is Track 2's) | Track 2 (visuals) | ⏳ follow-up |
| 5 | DB trigger de-duplication (generate SQL from `pricing.ts`, or shared values file) | This track | ⏳ follow-up — see `web/docs/pricing.md` |
| 6 | Add `trial_period_days` to `createCheckoutSession()` + Stripe product config | Business + this track | ⏳ business decision required (trial length) |
| 7 | Align "Start Free Trial" CTA copy with actual trial once enabled | Track 4 (content/i18n) | ⏳ depends on #6 |

---

## Consequences

### Positive

- **No rework of billing infrastructure.** Checkout, portal, webhook, and the
  `subscriptions` table already work; this decision keeps them.
- **Recurring revenue matches the product.** Construction firms run photo logs
  continuously; a monthly/annual subscription is how this category is bought
  (industry norm for construction-management SaaS).
- **Upgrade/downgrade is already designed for.** The webhook updates `plan` on
  `customer.subscription.updated`, so moving a customer between tiers is
  plumbing that exists.
- **Trial-friendly.** A status-aware gate makes `trialing` a first-class state
  that grants paid limits with zero extra code once checkout passes
  `trial_period_days`.
- **Downgrade is graceful.** A `past_due` or cancelled subscriber falls back to
  the free tier immediately at the enforcement layer (read-only on the
  customer's existing data, no deletion).

### Negative / risks

- **Ongoing payment dependency.** The product stops being usable at paid limits
  if a firm stops paying — the trade-off of SaaS. Mitigated by the free tier
  (5 projects / 500 photos) so data remains accessible.
- **PCI/churn operational burden.** Subscription billing requires handling
  dunning, retries, and support queries; the `invoice.payment_failed` →
  `past_due` flow already starts this but no dunning emails are wired.
- **Two enforcement layers to keep in sync.** App-layer `getUserPlan` and the
  DB triggers both encode limits; until de-duplication (change #5), editing a
  limit requires touching 3–4 places. This is the price of atomic DB
  enforcement (the TOCTOU fix) — see `web/docs/pricing.md` for the cleanup
  plan.
- **Stripe status vocabulary leaks into the app.** `status` is a free-text
  column; enforcement hardcodes the Stripe status set (`active`, `trialing`).
  A future provider change (e.g. Paddle) would need the same mapping.

---

## Alternatives

### A. Ready-made, one-time product (rejected)

**What it would mean:** Sell the app once per company (e.g. a perpetual license
or a fixed "setup" price), remove monthly billing.

**Facts against it:**
- The entire Stripe subscription stack (table, checkout `mode:'subscription'`,
  portal, webhook lifecycle) would be dead code. Every one of the 5 webhook
  cases, the `status` column, `current_period_*`, `cancel_at_period_end`
  becomes meaningless.
- There is no perpetual-license pricing plumbing anywhere today; this path
  would be *more* work than the subscription fix.
- One-time revenue does not match the product's recurring operational value
  (daily logs, attendance, ongoing photo accrual) nor how construction firms
  buy software.
- No built-in path for upgrades as a firm grows (company → multi-office).

### B. Subscription (chosen) — see [Decision](#decision)

### C. Hybrid: subscription + one-time/licensed add-ons (deferred)

**What it would mean:** Standard monthly SaaS, plus optional one-time
purchases (e.g. a legacy-archive export, site-specific schema packs, or an
annual "perpetual license" of the PDF report module).

**Why not now:** No implementation exists for one-off purchases (Stripe
`mode: 'payment'`), and the Company tier's "Contact Sales" already covers
custom/negotiated deals. If a firm specifically asks to buy a permanent copy,
that is a sales conversation, not a product pivot. Revisit only if real
customer demand for one-time purchase emerges.

---

## Follow-ups (non-blocking, tracked elsewhere)

- `web/docs/pricing.md` — plan structure, change procedure, duplication matrix,
  and the DB trigger de-duplication plan.
- Trial rollout (change #6) requires: a business decision on trial length,
  Stripe product config, `trial_period_days` in `createCheckoutSession()`, and
  i18n copy alignment.
- Dunning emails for `past_due` subscribers (no current automation).
