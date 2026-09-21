# Construction Photo Log

> 🇲🇰 [Македонски](./README.mk.md) | **English**

Web app for construction photo documentation. Shoot, organize by project, and generate inspection-ready PDF reports — with defects, work orders, attendance, daily logs, and QR-verifiable authenticity.

**What makes it different:** tamper-evident SHA-256 report manifests with public QR verification — any client can independently verify a report. Auditable code, open stack.

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes (37 routes), Supabase (Auth + Postgres + Storage)
- **PDF reports:** generated in `web/lib/pdf/` with pdfkit
- **i18n:** 5 locales (mk source, en, de, sl, sr) — 1,044 keys in sync

## Features

- 📸 Photo upload with EXIF (GPS + timestamp), compression and thumbnails
- 🏗️ Project organization with roles (admin, site_manager, foreman, photographer, client)
- 🐞 Defects (kanban), 🔧 work orders and their linking
- 📋 Daily logs, ⏱️ attendance (check-in/out), 📌 drawing pins
- 💬 Comments with @mentions and notifications
- 🏷️ Company labels and label groups
- 📄 PDF reports with QR code for independent verification (`/verify/[manifestId]`)
- 📊 Admin command center (stats, audit logs, team management)
- 🗺️ GPS map, timeline, calendar and timelapse views
- 🌙 Dark mode, PWA with offline outbox

## Quickstart

```bash
cd web
npm install
cp .env.local.example .env.local   # fill in your Supabase credentials
npx supabase db push               # apply migrations (44+)
npm run dev          # dev server
npm run type-check   # types
npm run lint         # lint
npm run test         # Vitest (384 tests)
```

## Project Layout

```
├── web/                          # Next.js application
│   ├── app/                      # App Router pages + API routes
│   │   ├── api/                  # 37 server routes (validation, RBAC, rate limits)
│   │   └── [locale]/             # Localized pages (dashboard, projects, admin…)
│   ├── components/               # React components (ui, admin, defects, labels…)
│   ├── hooks/                    # Domain hooks (defects, pins, attendance…)
│   ├── lib/                      # Server logic (api, auth, pdf, storage, evidence…)
│   ├── messages/                 # Translations (mk, en, de, sl, sr)
│   └── docs/adr/                 # Architecture decision records
├── supabase/migrations/          # Versioned Postgres schema + RLS policies
└── docs/                         # Specs, plans and audit reports
```

## Security Model (short version)

Company-scoped multi-tenancy (RLS + per-route checks), RBAC hierarchy,
PATCH allowlists, rate limits on all mutations, audit trail and
tamper-evident report manifests. Details: [`web/AGENTS.md`](web/AGENTS.md),
[`SECURITY.md`](SECURITY.md).

## Contributing

PRs welcome — start with [`CONTRIBUTING.md`](CONTRIBUTING.md) and the
[`good-first-issue`](https://github.com/ilenacev102/construction-photo-log/issues?q=is%3Aissue+is%3Aopen+label%3Agood-first-issue)
label. Report vulnerabilities privately per [`SECURITY.md`](SECURITY.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).
