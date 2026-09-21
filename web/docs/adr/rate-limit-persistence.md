# ADR: Rate Limiter Persistence (in-memory vs Supabase-backed)

Status: Accepted (deferred implementation)
Date: 2026-09-18

## Context

`web/lib/api/rate-limit.ts` implements an in-memory sliding-window limiter
(Map + 5-minute self-clean). It now guards ~40 mutation handlers across the
API layer (uploads, CRUD, invites, comments, exports, verify).

On serverless (Vercel) each instance holds its own Map, so limits reset on
cold start and do not aggregate across instances. The limiter is therefore a
speed bump against casual abuse, not a security boundary.

The Content-Security-Policy in `web/next.config.ts` was assessed in the same
pass: it already sets `object-src 'none'`, `base-uri 'self'`, `form-action
'self'`, `frame-ancestors 'none'` and `upgrade-insecure-requests`. Only
`script-src 'unsafe-inline' 'unsafe-eval'` remain, which Next.js itself
requires for hydration. Nonce-based CSP would need a middleware overhaul and
is out of scope while `unsafe-*` is framework-mandated.

## Decision

1. Keep the in-memory limiter as-is. Abuse containment rests on
   authentication + RBAC + RLS; the limiter only slows opportunistic spam.
2. Do NOT migrate to a Supabase-backed limiter now: `checkRateLimit` is
   synchronous and has ~40 call sites. A persistent limiter requires an
   async API, a new `rate_limit_buckets` table with service-role-only RLS,
   and rewrites of every guarded handler — a dedicated feature branch,
   not a hardening commit.
3. CSP stays as configured. Revisit nonce-based CSP only if Next.js drops
   the `unsafe-*` requirement.

## Consequences

- Rate limits are per-instance and best-effort on serverless; accepted risk.
- Any future persistent limiter MUST keep the current sync call-site shape
   or budget a full 40-site migration with test updates.
- `npm audit --audit-level=critical` in CI remains the automated gate for
  dependency regressions.
