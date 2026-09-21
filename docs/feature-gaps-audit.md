# Feature Gaps Audit — Construction Photo Log

> Audit date: 2026-08-10
> Method: full route survey (26 routes) + dead-code/placeholder scan + spec comparison

## A. Advertised features that do NOT exist (critical)

| # | Gap | Evidence |
|---|---|---|
| A1 | **"Start Free Trial" is a lie** — CTA on crew/team plans, but `createCheckoutSession()` sends no `trial_period_days` → click = immediate full charge | `messages/en.json:691,705` vs `stripe.ts:26-46`; ADR-001 marks it pending |
| A2 | **QR attendance is a stub** — pricing advertises "QR attendance", UI says "QR Code for check-in", but `AttendancePanel` renders only a **decorative SVG icon** + truncated project ID. No QR check-in API anywhere | `pricing.ts:68`, `AttendancePanel.tsx:107-114` |
| A3 | **API access (Company)** — advertised, zero code | `pricing.ts:129,143` |
| A4 | **SSO/SAML (Company)** — advertised, zero code | `pricing.ts:130,144` |
| A5 | **Trade templates** — DB table exists + `useTrades.ts` hook written, but **nothing imports it** → feature unreachable | `20260725000005_create_trade_templates.sql`, `hooks/useTrades.ts` |
| A6 | **Feature flags not enforced** — `plan-limits.ts` counts only projects/photos/users; defects/pins/audit/daily-logs are **free for everyone** despite table saying free=false | `pricing.ts` vs `plan-limits.ts` |

## B. Missing workflows (structural gaps)

| # | Gap |
|---|---|
| B1 | **No billing/subscription management page** — `useSubscription` is dead, i18n namespace "Manage your plan and billing" rendered nowhere |
| B2 | **No invite UI** — `/api/invite` exists, zero UI calls it |
| B3 | **Client role has no surface** — no portal; QR code links to auth-protected page (useless for client without account) |
| B4 | **`/admin/team` is a dead link for managers** — `AdminLayout` allows only admin, but Navbar + Manager Dashboard advertise it to `site_manager` → Access Denied |
| B5 | **No project edit/delete/archive UI** — `deleteProject()` never called |
| B6 | **No profile/settings/account page** |
| B7 | **No onboarding for users without assigned role** |
| B8 | **Worker dashboard "Daily Log" button links to photos page** (wrong link) |
| B9 | **No work order / task assignment system for employees** — the requested feature |

## C. Dead code + stale docs

- `useTrades.ts`, `CanPermission.tsx`, `useSubscription.ts` — no imports anywhere
- `web/supabase/migrations/` — duplicate of only 2 legacy migrations (root has 30)
- `docs/pricing.md` claims a TODO marker that does not exist; ADR claims pricing page has hardcoded PLANS — already refactored

## D. Deliberate placeholders (aware, not bugs)

- Hero section: fabricated metrics + "100% OFFLINE-READY" (no offline code exists)
- `currentPlan` disabled button (legitimate)
- PDF error fallback text

---

## Priority recommendation

1. **A1 (Free Trial lie)** — revenue-critical, legal risk. Fix: pass `trial_period_days` or remove CTA.
2. **A2 (QR stub)** — advertised feature, user-facing fake. Fix: real QR generation + check-in API, or demote marketing claim.
3. **B4 (admin/team dead link)** — easy fix: hide from managers or allow managers.
4. **B9 (Work orders)** — the requested feature (see design doc).
5. Rest — backlog.
