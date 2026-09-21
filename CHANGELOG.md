# Changelog

All notable changes to this project, newest first. Entries mirror the
conventional-commit history (`git log --oneline`).

## Unreleased (main, after `7c99933`)

### Security
- Rate limit all mutation routes: core CRUD, entity mutations, auxiliary
  mutations, invite, comments, export, verify, work-order links
  (`d492bf8`, `ea49447`, `18a2da8`, `ba1419b`, `47e50b2`, `a73788a`).
- Render comment mentions as safe React nodes, removing stored-XSS via
  `dangerouslySetInnerHTML` (`593f52b`).
- Clamp audit-log pagination (1–200) against table-scan DoS; hide raw DB
  errors behind generic 500s (`a73788a`).

### Evidence OS
- Report manifests migration + manifest hash library (`29b1281`).
- QR verification flow with public verify pages (`8dbb86c`).
- Harden verify batch fetch (bounded parallelism, timeouts, missing-row
  handling) and cap PDF image scale (`b314e86`).

### Integrity
- Orphan storage cleanup on DB failure, bounded signed-URL cache,
  `..`-path rejection, EXIF via monitoring (`052e8e0`).

### Dependencies (9 → 2 advisories)
- Bump sharp (libheif) and Next.js 16.3.5 (critical RCE)
  (`78210e6`, `ff77894`).
- Pin qs, hono, js-yaml, nanoid, fast-uri via npm overrides
  (`acf67b2`, `f1c8749`).
- Remaining: 2 moderate dev-only vitest advisories (blocked by an npm
  resolver bug — see commit history).

### Frontend
- Label admin split into reusable components (`dfb8e19`).
- Stable session persistence across tabs/layouts; proxy verify paths
  (`30a7d60`, `d78c61d`).
- Admin widgets, action badges, header hierarchy (`ec7af94`, `b2593dc`).
- UI primitives polish, checkbox/select additions (`788ece3`, `f6a1f84`).
- Remove duplicate project h1; gate admin fetch on role (`f683a3c`).
- Hooks: simplified daily-logs lifecycle; error + refetch for defects
  and pins (`be1f89e`, `fb7374d`).

### i18n (mk source, en/de/sl/sr in sync)
- Nested `auditLog.actions`; sentence-case alignment (`d92e8c1`).
- Nested notification entities; `daily_log` alias key (`815c7a9`).

### CI / Docs
- Drop dead Python package job; gate on critical `npm audit`
  (`df17956`, `2f7e411`).
- ADR: rate-limiter persistence decision
  (`web/docs/adr/rate-limit-persistence.md`).

### API refactors
- Align project/team/permission, schemas/pins/label, attendance/audit
  routes with tests (`fa26824`, `5353dc1`, `559558e`).
- Throttle export; clamp audit pagination (`a73788a`).

## `7c99933` — Platform: corporate hardening wave

RLS, integrity, thumbnails, offline outbox.
