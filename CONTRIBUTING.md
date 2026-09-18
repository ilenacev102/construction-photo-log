# Contributing

## Ground Rules

- English for code, commit messages and PRs. Docs may be Macedonian and/or
  English; new user-facing strings need all 5 locales (`mk` first, then
  `en`, `de`, `sl`, `sr`) — see `web/messages/`.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`,
  `ci:`, `test:`). One logical change per commit, ≤4 files preferred.
- Every commit must pass before push:
  `npm run type-check && npm run lint && npm run test` (in `web/`).
- No `any`, no `unwrap()`-style shortcuts, no secrets in code. Comments
  explain WHY, not WHAT. Keep new code covered by tests.

## Local Setup

```bash
cd web
npm install
cp .env.local.example .env.local   # fill in Supabase credentials
npx supabase start                  # or use Supabase Cloud free tier
npx supabase db push                # apply migrations (44+)
npm run dev
```

Seed a demo company via the signup flow, then promote yourself to admin
(see `docs/SELF-HOSTING.md` — new signups default to `photographer`).

## Architecture Map

- `web/lib/api/` — auth guard, company/project access, Zod schemas,
  rate limiting, error envelope. Read these first.
- `web/lib/auth/` — RBAC hierarchy, workspace resolution.
- `web/lib/supabase/` — four clients (browser singleton, SSR, admin,
  queries). Service-role bypasses RLS: only after `requireAuth` +
  `requireProjectAccess`/`requireProjectMutate`.
- `supabase/migrations/` — versioned schema + RLS. Never edit an applied
  migration; add a new one.
- `web/lib/evidence/` + `web/lib/pdf/` — tamper-evident manifests.

## Good First Issues

Look for `good-first-issue`: i18n gaps, empty-state illustrations, docs,
additional rate-limit coverage, test coverage for uncovered branches.

## Pull Requests

- Link the issue. Describe WHAT changed and WHY.
- CI must be green (type-check, lint, 384+ tests, critical audit gate).
- Security-sensitive areas (auth, RLS, uploads, manifests) need a
  maintainer review — expect adversarial questions, that is normal here.
