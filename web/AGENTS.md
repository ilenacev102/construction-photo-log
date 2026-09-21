<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Фото Градежен Дневник — AI Agent Guide

## Project Overview & Stack

### Purpose

Фото Градежен Дневник ("Construction Photo Log") is a bilingual web application for photo documentation of construction sites. Crews capture photos, organize them by project, and generate PDF inspection reports. The app speaks Macedonian on screen and English in code and agent-facing contexts. The root README (`README.md`) describes it as:

> Веб апликација за фото документација на градежни објекти. Сликајте, организирајте по проекти и генерирајте PDF извештаи за инспекција.

Core capabilities: photo upload with EXIF extraction, project-scoped organization, timeline view, GPS coordinates via Leaflet maps, Supabase-backed auth and storage, and server-side PDF report generation.

### Tech Stack

Every entry below is verified against `web/package.json` dependencies and devDependencies. No tool is listed without a matching entry in that file.

| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16 (pkg: `next` ^16.3.0) | App Router framework, API routes, server components |
| React | 19 (pkg: `react` ^19.2.8, `react-dom` ^19.2.8) | UI runtime |
| TypeScript | 6 (pkg: `typescript` ^6.0.3) | Static typing (strict mode configured in tsconfig) |
| Tailwind CSS | 4 (pkg: `tailwindcss` ^4, `@tailwindcss/postcss` ^4) | Utility-first CSS |
| shadcn/ui | 4 (pkg: `shadcn` ^4.14.1) | Component scaffolding CLI; generates components using Base UI and Radix primitives |
| Base UI | 1 (pkg: `@base-ui/react` ^1.6.0) | Headless unstyled UI primitives (Material UI ecosystem) |
| Radix UI | various (pkg: `@radix-ui/react-dialog` ^1.1.21, `@radix-ui/react-dropdown-menu` ^2.1.22, `@radix-ui/react-label` ^2.1.13, `@radix-ui/react-select` ^2.3.5, `@radix-ui/react-slot` ^1.3.1) | Headless accessible primitives for dialogs, menus, labels, selects |
| Lucide React | 1 (pkg: `lucide-react` ^1.26.0) | Icon library |
| Supabase | 2 (pkg: `@supabase/supabase-js` ^2.110.8, `@supabase/ssr` ^0.12.3) | Auth, database, and file storage backend |
| Zod | 4 (pkg: `zod` ^4.4.3) | Schema validation |
| react-hook-form | 7 (pkg: `react-hook-form` ^7.87.0) | Form state management |
| @hookform/resolvers | 5 (pkg: `@hookform/resolvers` ^5.9.1) | Zod resolver for react-hook-form |
| date-fns | 4 (pkg: `date-fns` ^4.4.0, `@date-fns/tz` ^1.5.0) | Date formatting and timezone handling |
| class-variance-authority | 0 (pkg: `class-variance-authority` ^0.7.1) | Variant-based className composition |
| clsx | 2 (pkg: `clsx` ^2.1.1) | Conditional className joining |
| tailwind-merge | 3 (pkg: `tailwind-merge` ^3.6.0) | Deduplication of conflicting Tailwind classes |
| tw-animate-css | 1 (pkg: `tw-animate-css` ^1.4.0) | Animation utilities for Tailwind |
| Leaflet | 1 (pkg: `leaflet` ^1.9.4) | Interactive maps for GPS photo locations |
| PDFKit | 0 (pkg: `pdfkit` ^0.19.1) | Server-side PDF report generation |
| sharp | 0 (pkg: `sharp` ^0.35.3) | High-performance image processing |
| exifr | 7 (pkg: `exifr` ^7.1.3) | EXIF metadata extraction from uploaded photos |
| qrcode | 1 (pkg: `qrcode` ^1.5.4) | QR code generation (likely for report embedding) |
| next-intl | 4 (pkg: `next-intl` ^4.13.4) | Internationalization (Macedonian/English routing) |
| ESLint | 9 (pkg: `eslint` ^9.39.5, `eslint-config-next` ^16.3.0) | Linting |
| Vitest | 4 (pkg: `vitest` ^4.1.10) | Unit and integration test runner |
| Testing Library | various (pkg: `@testing-library/react` ^16.3.2, `@testing-library/dom` ^10.4.1, `@testing-library/jest-dom` ^7.0.0) | React component testing utilities |
| jsdom | 30 (pkg: `jsdom` ^30.0.1) | DOM environment for Vitest |

The `next.config.ts` file (`web/next.config.ts`) applies `next-intl/plugin`, marks `pdfkit` as a server-external package, whitelists Supabase and OpenStreetMap domains for images, and sets security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).

### Core Commands

All commands run from the `web/` directory. Script names are taken verbatim from `web/package.json`:

```bash
npm run dev          # Start Next.js dev server (next dev)
npm run build        # Production build (next build)
npm run start        # Serve production build (next start)
npm run lint         # Run ESLint (eslint)
npm run type-check   # TypeScript type checking without emit (tsc --noEmit)
npm run test         # Run Vitest test suite once (vitest run)
npm run test:watch   # Run Vitest in watch mode (vitest)
```

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Starts the Next.js development server with hot reload |
| `npm run build` | Produces an optimized production build |
| `npm run start` | Serves the production build |
| `npm run lint` | Checks code against the ESLint config |
| `npm run type-check` | Runs the TypeScript compiler in check-only mode (no output files) |
| `npm run test` | Executes the full Vitest test suite once |
| `npm run test:watch` | Starts Vitest in interactive watch mode |

### Version-Warning Enforcement

This project runs **Next.js 16** and **React 19**. These are major-version releases with breaking API changes, deprecations, and altered conventions compared to any prior version. The file `web/AGENTS.md` already carries this warning (quoted here for reference only, not reproduced as original content):

> "This is NOT the Next.js you know. This version has breaking changes -- APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

Any agent writing Next.js code in this project **must**:

1. Consult `node_modules/next/dist/docs/` for the version-specific guides before using any Next.js API. Training data about Next.js 14 or 15 does not apply here.
2. Check the `next.config.ts` file (`web/next.config.ts`) for active plugins (currently `next-intl/plugin`) and server configuration before adding routes or modifying config.
3. Treat every Next.js API surface (routing, middleware, server components, image handling, headers) as potentially different from what was learned during training. When in doubt, read the docs first, write code second.

## Architecture Map

### Repository Layout

```
construction-photo-log/              # monorepo root
├── web/                             # Next.js 16 App Router application (main deliverable)
│   ├── app/                         # App Router: pages, API routes, layouts
│   │   ├── layout.tsx               # Root <html> shell — no providers, bare skeleton
│   │   ├── globals.css              # Tailwind v4 entry + global styles
│   │   ├── error.tsx                # Root-level error boundary
│   │   ├── not-found.tsx            # Root-level 404 page
│   │   ├── manifest.ts              # PWA web app manifest
│   │   ├── robots.ts                # robots.txt generator
│   │   ├── sitemap.ts               # Dynamic sitemap generator
│   │   ├── favicon.ico              # Site icon
│   │   ├── auth/                    # OAuth callback routes (auth/callback/)
│   │   ├── api/                     # Route handlers — 22 API domains + __tests__/
│   │   └── [locale]/                # Dynamic locale root (see Routing Model below)
│   │       ├── layout.tsx           # Locale layout — providers + JSON-LD metadata
│   │       ├── page.tsx             # Landing / home page
│   │       ├── loading.tsx          # Locale-level Suspense fallback
│   │       ├── error.tsx            # Locale-level error boundary
│   │       ├── not-found.tsx        # Locale-level 404
│   │       ├── admin/               # Admin panel (audit, labels, team, users)
│   │       ├── blog/                # Marketing blog pages
│   │       ├── case-studies/        # Case study pages
│   │       ├── checkin/             # Field check-in feature
│   │       ├── cookies/             # Cookie policy page
│   │       ├── dashboard/           # Main authenticated dashboard
│   │       ├── login/               # Login page
│   │       ├── privacy/             # Privacy policy page
│   │       ├── projects/            # Project management pages
│   │       ├── security/            # Security policy page
│   │       ├── signup/              # Sign-up page
│   │       ├── terms/               # Terms of service page
│   │       └── work-orders/         # Work order management pages
│   ├── components/                  # React components
│   │   ├── ui/                      # shadcn/ui primitives (15 components)
│   │   ├── admin/                   # Admin panel widgets (6 components + __tests__/)
│   │   ├── comments/                # Comment thread system (4 components)
│   │   ├── defects/                 # Kanban defect board (6 components)
│   │   ├── labels/                  # Label badge, filter, picker (3 components)
│   │   ├── notifications/           # Notification dropdown (1 component)
│   │   ├── work-orders/             # Work order CRUD forms (4 components)
│   │   ├── AuthForm.tsx             # Login/signup form
│   │   ├── Navbar.tsx               # Main navigation bar
│   │   ├── PhotoUpload.tsx          # Photo upload with EXIF extraction
│   │   ├── PhotoTimeline.tsx        # Chronological photo view
│   │   ├── PhotoLightbox.tsx        # Full-screen photo viewer
│   │   ├── PhotoMap.tsx             # GPS-mapped photo pins
│   │   ├── ProjectCard.tsx          # Project summary card
│   │   ├── DailyLogForm.tsx         # Daily log entry form
│   │   ├── ReportBuilder.tsx        # PDF report builder UI
│   │   └── ... (50+ components total)
│   ├── contexts/                    # React context providers
│   │   ├── UserContext.tsx           # Current user state (auth + profile)
│   │   └── __tests__/               # Context unit tests
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAttendance.ts         # Attendance tracking
│   │   ├── useDailyLogs.ts          # Daily log CRUD
│   │   ├── useDefects.ts            # Defect board state
│   │   ├── useLabels.ts             # Label management
│   │   ├── usePermissions.ts        # RBAC permission checks
│   │   ├── usePins.ts               # Blueprint pin mapping
│   │   ├── useRole.ts               # User role resolution
│   │   ├── useTrades.ts             # Trade/subcontractor data
│   │   └── useWorkOrders.ts         # Work order state
│   ├── i18n/                        # Internationalization config
│   │   ├── navigation.ts            # Localized URL helpers
│   │   ├── request.ts               # next-intl request config
│   │   └── routing.ts               # Locale definitions + pathnames
│   ├── lib/                         # Shared utilities and server logic
│   │   ├── api/                     # API route helpers (validation, auth, rate-limit)
│   │   │   ├── auth-guard.ts        # Server-side auth gate for API routes
│   │   │   ├── company-auth.ts      # Company-scoped authorization
│   │   │   ├── errors.ts            # API error response helpers
│   │   │   ├── field-whitelists.ts  # Allowed field lists per entity type
│   │   │   ├── rate-limit.ts        # Request rate limiting
│   │   │   ├── schemas.ts           # Shared Zod request schemas
│   │   │   ├── validate.ts          # Request body validation wrapper
│   │   │   └── __tests__/           # API helper unit tests (4 files)
│   │   ├── auth/                    # Auth/RBAC logic
│   │   │   ├── rbac.ts              # Role-based access control
│   │   │   └── workspace.ts         # Workspace scoping
│   │   ├── supabase/                # Supabase client factories
│   │   │   ├── admin.ts             # Service-role client (bypasses RLS)
│   │   │   ├── client.ts            # Browser client (public anon key)
│   │   │   ├── server.ts            # Server client (cookie-based auth)
│   │   │   └── queries.ts           # Shared query helpers
│   │   ├── pdf/                     # PDF report generation (pdfkit)
│   │   │   ├── generator.ts         # PDF builder logic
│   │   │   └── __tests__/           # PDF generator tests
│   │   ├── image/                   # Image processing
│   │   │   └── compress.ts          # Client-side image compression
│   │   ├── storage/                 # Storage helpers
│   │   │   ├── signed-url.ts        # Signed URL generation for Supabase Storage
│   │   │   └── __tests__/           # Signed URL tests
│   │   ├── validation/              # Zod validation schemas
│   │   │   ├── schemas.ts           # Entity-level validation rules
│   │   │   └── __tests__/           # Schema tests
│   │   ├── admin/                   # Admin dashboard helpers
│   │   │   ├── overview.ts          # Admin overview/stats queries
│   │   │   └── __tests__/           # Admin tests
│   │   ├── __tests__/               # Unit tests for top-level lib modules (14 files)
│   │   ├── dashboard.ts             # Dashboard data aggregation
│   │   ├── audit.ts                 # Audit log helpers
│   │   ├── monitoring.ts            # Health check / uptime monitoring
│   │   ├── exif.ts                  # EXIF metadata extraction
│   │   ├── export.ts                # Data export utilities
│   │   ├── time.ts                  # Date/time helpers
│   │   ├── utils.ts                 # General-purpose utilities
│   │   ├── mentions.ts              # @mention parsing
│   │   ├── blog.ts                  # Blog content helpers
│   │   ├── health-tiers.ts          # Project health score tiers
│   │   ├── defect-aging.ts          # Defect age classification
│   │   ├── photo-calendar.ts        # Photo calendar heatmap data
│   │   ├── project-compare.ts       # Side-by-side project comparison
│   │   ├── project-timeline.ts      # Project timeline aggregation
│   │   ├── risk-score.ts            # Risk scoring algorithm
│   │   └── weather-summary.ts       # Weather data summarization
│   ├── messages/                    # next-intl translation catalogs
│   │   ├── mk.json                  # Macedonian (default locale)
│   │   ├── en.json                  # English
│   │   ├── de.json                  # German
│   │   ├── sl.json                  # Slovenian
│   │   └── sr.json                  # Serbian
│   ├── public/                      # Static assets served at /
│   │   ├── fonts/                   # Self-hosted font files
│   │   ├── sw.js                    # Service worker for offline/PWA
│   │   └── *.svg                    # Static icons (globe, next, vercel, etc.)
│   ├── types/                       # TypeScript type definitions
│   │   ├── database.ts              # Supabase generated database types
│   │   └── pdfkit.d.ts              # pdfkit ambient type declaration
│   ├── content/                     # Blog/content markdown files
│   │   └── blog/                    # Blog post source files
│   ├── docs/                        # Web-app-specific documentation
│   │   ├── adr/                     # Architecture decision records
│   │   ├── content-localization.md  # i18n implementation guide
│   │   ├── perf-audit.md            # Performance audit notes
│   │   └── pricing.md               # Pricing tier documentation
│   ├── e2e/                         # End-to-end test infrastructure
│   │   ├── fixtures/                # Test fixture data
│   │   └── results/                 # Test result artifacts
│   ├── DESIGN.md                    # Design system reference
│   ├── CLAUDE.md                    # AI agent instructions (project-specific)
│   ├── AGENTS.md                    # Agent behavior rules (Next.js 16 guard)
│   ├── next.config.ts               # Next.js configuration
│   ├── vitest.config.ts             # Vitest test runner config
│   ├── vitest.setup.ts              # Vitest global setup
│   ├── eslint.config.mjs            # ESLint flat config
│   ├── postcss.config.mjs           # PostCSS + Tailwind config
│   ├── components.json              # shadcn/ui configuration
│   ├── proxy.ts                     # Dev proxy helper
│   ├── vercel.json                  # Vercel deployment config
│   ├── tsconfig.json                # TypeScript config
│   └── package.json                 # Dependencies and scripts
├── supabase/                        # Supabase project configuration
│   ├── config.toml                  # Supabase local dev config
│   ├── plan_limits.generated.sql    # Auto-generated plan limit constraints
│   ├── migrations/                  # 40 SQL migration files
│   └── snippets/                    # Reusable SQL snippets
├── docs/                            # Repository-level documentation
│   ├── plans/                       # Feature planning docs
│   ├── superpowers/                 # Agent capability docs
│   ├── spec.md                      # Product specification
│   ├── platform-design.md           # Platform architecture
│   └── *-audit.md                   # Various audit reports
└── README.md                        # Repo README (Macedonian)
```

### Directory Responsibilities

| Directory | Responsibility |
|---|---|
| `web/app/` | App Router file-system routing: page components, API route handlers, layout hierarchy |
| `web/app/[locale]/` | Locale-scoped pages — every user-facing route lives under `/{locale}/...` |
| `web/app/api/` | Server-side API route handlers (22 domains: photos, projects, defects, work-orders, etc.) |
| `web/app/auth/` | OAuth callback handler for Supabase auth flow |
| `web/components/ui/` | shadcn/ui primitive components (button, card, dialog, data-table, skeleton, etc.) |
| `web/components/admin/` | Admin dashboard widgets (permissions view, org stats, quick operations) |
| `web/components/comments/` | Comment thread system (form, item, thread, count badge) |
| `web/components/defects/` | Kanban-style defect board (board, card, column, create modal, detail view) |
| `web/components/labels/` | Label/tag UI (badge, filter bar, picker) |
| `web/components/notifications/` | Notification dropdown component |
| `web/components/work-orders/` | Work order CRUD forms and list views |
| `web/contexts/` | React context providers — `UserContext` holds authenticated user state |
| `web/hooks/` | Domain-specific hooks (attendance, daily logs, defects, labels, permissions, pins, role, trades, work-orders) |
| `web/i18n/` | next-intl configuration: locale routing, pathnames, request plugin |
| `web/lib/api/` | Server-side helpers for API routes (auth guards, rate limiting, Zod validation, error responses) |
| `web/lib/auth/` | RBAC role logic and workspace-scoped authorization |
| `web/lib/supabase/` | Supabase client factories: `admin.ts` (service role, bypasses RLS), `client.ts` (browser anon), `server.ts` (cookie-based SSR) |
| `web/lib/pdf/` | Server-side PDF report generation via pdfkit |
| `web/lib/image/` | Client-side image compression before upload |
| `web/lib/storage/` | Supabase Storage signed-URL generation |
| `web/lib/validation/` | Shared Zod schemas for entity validation |
| `web/lib/admin/` | Admin dashboard query helpers (org stats, usage) |
| `web/lib/__tests__/` | Unit tests for top-level lib modules (14 test files) |
| `web/lib/` (top-level) | Domain modules: dashboard aggregation, audit logging, monitoring, EXIF extraction, export, time, risk scoring, health tiers, defect aging, photo calendar, weather, mentions, blog |
| `web/messages/` | next-intl translation catalogs — one JSON file per locale (mk, en, de, sl, sr) |
| `web/public/` | Static assets: SVG icons, self-hosted fonts, service worker |
| `web/types/` | TypeScript type definitions — `database.ts` (Supabase generated types), `pdfkit.d.ts` (ambient declaration) |
| `web/content/` | Blog post markdown source files |
| `web/e2e/` | Playwright end-to-end test fixtures and result artifacts |
| `supabase/migrations/` | **40 SQL migration files** — schema versioning for the Supabase Postgres database |
| `supabase/` (root) | Supabase project config (`config.toml`), generated SQL, reusable snippets |
| `docs/` | Repository-level specs, audit reports, architecture docs, feature plans |

> Note: PDF reports are generated in-app via `web/lib/pdf/generator.ts` (no Python package).

### Routing Model

The application uses Next.js App Router with a **dynamic locale segment** at `app/[locale]/`. Every user-facing page is served under `/{locale}/...` where `{locale}` is one of:

| Locale | Language | Default? |
|---|---|---|
| `mk` | Macedonian | Yes (default) |
| `en` | English | No |
| `de` | German | No |
| `sl` | Slovenian | No |
| `sr` | Serbian | No |

**Root layout** (`web/app/layout.tsx`): A minimal HTML shell. Sets `<html lang="mk">`, injects global CSS, mounts `HtmlLangSync` and `ServiceWorkerRegistration`. No React context providers at this level.

**Locale layout** (`web/app/[locale]/layout.tsx`): The real application shell. Wraps children in:
1. `NextIntlClientProvider` — injects translated messages from `getMessages()`
2. `AriaStatusProvider` — accessible status announcements
3. `UserProvider` — authenticated user context from `UserContext`
4. `PublicSiteShell` — navigation chrome (`Navbar`, `PublicHeader`, `PublicFooter`)

This layout also generates dynamic per-locale `<Metadata>` (title, description, OpenGraph, Twitter cards, canonical URLs, `hreflang` alternates) and injects structured data (`application/ld+json`) for SEO.

**Static vs. dynamic behavior**: Neither layout exports `dynamic`, `revalidate`, or `fetchCache` directives. Both call async server functions (`getMessages`, `getTranslations`, `generateMetadata` with `params: Promise<{locale: string}>`). Under Next.js 16 defaults, pages without explicit static configuration are rendered dynamically per request. The `[locale]/page.tsx` landing page and most authenticated pages (dashboard, projects, work-orders) are therefore dynamically rendered. Static generation would require explicit `export const revalidate = N` or `export const dynamic = 'force-static'` — none are present in the current layout files.

**API routes** live at `web/app/api/{domain}/route.ts` and are NOT under the `[locale]` segment — they are locale-agnostic endpoints consumed by the locale-scoped frontend.

### Test Infrastructure

Unit tests are colocated with the code they test, using Vitest (`web/vitest.config.ts`):

| Test location | Scope | File count |
|---|---|---|
| `web/lib/__tests__/` | Top-level lib module tests | 14 files |
| `web/lib/api/__tests__/` | API helper tests (auth-guard, rate-limit, etc.) | 4 files |
| `web/lib/pdf/__tests__/` | PDF generator tests | 1 file |
| `web/lib/storage/__tests__/` | Signed URL tests | 1 file |
| `web/lib/validation/__tests__/` | Zod schema tests | 1 file |
| `web/lib/admin/__tests__/` | Admin overview tests | 1 file |
| `web/app/api/__tests__/` | API route handler tests (7 endpoints) | 7 files |
| `web/components/admin/__tests__/` | Admin component tests | 6 files |
| `web/contexts/__tests__/` | Context provider tests | 1 file |

End-to-end tests live in `web/e2e/` with Playwright fixtures and result storage.

## API Route Conventions

All API routes live at `web/app/api/{domain}/route.ts` and export named `GET`, `POST`, `PATCH`, or `DELETE` handler functions. The 22 domain endpoints are locale-agnostic — they sit outside the `[locale]` segment and are consumed by the locale-scoped frontend (`web/app/api/`).

### Response Envelope

Every API response uses a consistent `{data, error}` JSON envelope. Success and error helpers are defined in `web/lib/api/errors.ts`:

| Helper | Signature | HTTP Status | Envelope | Defined at |
|--------|-----------|-------------|----------|------------|
| `successResponse(data)` | `unknown → NextResponse` | 200 (default) | `{ data, error: null }` | `errors.ts:7-9` |
| `errorResponse(message, status?)` | `(string, number?) → NextResponse` | 400 (default) | `{ data: null, error: message }` | `errors.ts:3-5` |
| `unauthorizedResponse(message?)` | `(string?) → NextResponse` | 401 | `{ data: null, error: message }` | `errors.ts:11-13` |
| `forbiddenResponse(message?)` | `(string?) → NextResponse` | 403 | `{ data: null, error: message }` | `errors.ts:15-17` |
| `notFoundResponse(message?)` | `(string?) → NextResponse` | 404 | `{ data: null, error: message }` | `errors.ts:19-21` |

The convenience wrappers (`unauthorizedResponse`, `forbiddenResponse`, `notFoundResponse`) all delegate to `errorResponse` with a fixed status code and a Macedonian default message. For example, `forbiddenResponse()` defaults to `'Немате пристап до овој ресурс'` (`errors.ts:15`).

### Error Handling: `requireAuth` and `apiErrorResponse`

The auth gate and error router form a two-part error propagation pattern:

**`requireAuth()`** (`web/lib/api/auth-guard.ts:19-29`): Calls `supabase.auth.getUser()` via the cookie-based SSR client. On failure, it throws an `Error` with a `.status` property attached via `Object.assign`:

```typescript
// auth-guard.ts:23
throw Object.assign(new Error('Немате пристап. Најавете се повторно.'), { status: 401 })
```

This is **not** a plain `{status: 401}` object — it is a real `Error` instance augmented with a `status` field. The throw is caught by the route's `try/catch` block and forwarded to `apiErrorResponse`.

**`apiErrorResponse(err)`** (`auth-guard.ts:35-46`): The central catch-block handler. It inspects the error and branches:

1. **Line 36**: `if (err instanceof Error && 'status' in err)` — checks whether the error is an `Error` with a `.status` property (the shape `requireAuth` and `parseJsonBody` throw).
2. **Line 37**: Extracts `status` via `(err as Error & { status: number }).status`.
3. **Line 40-42**: If `status < 500`, passes through to `errorResponse(err.message, status)` — the user-facing message (auth denial, validation error, permission check) is returned as-is.
4. **Line 44-45**: If `status >= 500` or the error has no `.status`, logs via `monitoring.captureException(err)` and returns a generic 500: `errorResponse('Внатрешна грешка на серверот.', 500)`.

The key invariant: **4xx errors carry user-facing messages; 5xx errors never leak internal details**. This is enforced by the branching at `auth-guard.ts:38-45`.

### Request Body Validation: `validateBody`

`validateBody` (`web/lib/api/validate.ts:15-42`) wraps Zod schema validation and returns a `{data, error}` tuple:

```typescript
// validate.ts:15-18
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T | null; error: NextResponse | null }>
```

Behavior on three failure paths:

| Condition | Returns | Defined at |
|-----------|---------|------------|
| Malformed JSON (not parseable) | `{ data: null, error: errorResponse('Невалиден JSON во барањето.') }` | `validate.ts:23` |
| Non-object body (null, array, primitive) | Same as above | `validate.ts:27` |
| ZodError (validation failure) | `{ data: null, error: errorResponse(messages.join('; ')) }` — each Zod issue formatted as `path: message`, joined with `'; '` | `validate.ts:34-39` |
| Unknown error during parse | `{ data: null, error: errorResponse('Валидација не успеа.') }` | `validate.ts:41` |

On success, it returns `{ data: validatedBody, error: null }`. The calling pattern in every route is:

```typescript
const { data: body, error: validationError } = await validateBody(request, schema)
if (validationError) return validationError
// body is fully typed
```

All Zod schemas are defined in `web/lib/api/schemas.ts` (268 lines, 25+ schemas covering projects, daily logs, defects, work orders, pins, attendance, audit logs, invites, labels, permissions, photos, schemas, taggings, comments, users, reports, and more).

### Route Handler Skeleton

Every route follows the same structural pattern. The try block handles authentication, authorization, validation, business logic, and success/error responses. The catch block delegates to `apiErrorResponse`:

```typescript
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth, apiErrorResponse } from '@/lib/api/auth-guard'
import { errorResponse, successResponse } from '@/lib/api/errors'
import { validateBody } from '@/lib/api/validate'
import { createProjectSchema } from '@/lib/api/schemas'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const admin = createAdminClient()
    // ... query logic using admin client ...
    // if (dbError) return errorResponse(dbError.message, 500)
    return successResponse(data ?? [])
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    // ... permission checks ...
    const { data: body, error: validationError } = await validateBody(request, createProjectSchema)
    if (validationError) return validationError
    // ... mutation logic using admin client ...
    return successResponse(data)
  } catch (err: unknown) {
    return apiErrorResponse(err)
  }
}
```

### Canonical Code Sketch: `POST /api/projects`

The following sketch is adapted from the real route at `web/app/api/projects/route.ts:64-97` to illustrate the full pattern in a single readable block (~35 lines):

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate — throws Error{status:401} on failure
    const { user } = await requireAuth()

    // 2. Admin client (bypasses RLS — requires manual permission checks)
    const admin = createAdminClient()

    // 3. Company context + role gate
    const ctx = await getCompanyContext(admin, user.id)
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user.id).single()
    if (!isAdminUser(ctx) && profile?.role !== 'site_manager' && profile?.role !== 'admin') {
      return forbiddenResponse('Немате дозвола за креирање проекти')
    }

    // 4. Validate request body against Zod schema
    const { data: body, error: validationError } = await validateBody(request, createProjectSchema)
    if (validationError) return validationError

    // 5. Business logic — insert via admin client
    const { data, error } = await admin
      .from('projects')
      .insert({ name: body!.name, address: body!.address, client_name: body!.client_name, user_id: user.id })
      .select()
      .single()
    if (error) return errorResponse(error.message, 500)

    // 6. Success
    return successResponse(data)
  } catch (err: unknown) {
    // 7. Central error routing — 4xx pass-through, 5xx logged + generic
    return apiErrorResponse(err)
  }
}
```

Adapted from `web/app/api/projects/route.ts:64-97` with permission logic from lines 77-79, validation from lines 80-81, and DB insert from lines 84-93.

### Additional Patterns

**Query parameter validation** (no Zod): Routes that read from `searchParams` validate manually. The export route (`web/app/api/export/route.ts:178-181`) returns `errorResponse('Missing projectId parameter', 400)` and `errorResponse('Invalid type parameter ...', 400)` directly.

**Inline error responses**: Some routes return `errorResponse` with specific messages for known failure conditions without going through Zod. For example, `attendance/route.ts:118` returns `errorResponse('Missing projectId')` when a required query param is absent, and `attendance/route.ts:145` returns `errorResponse('Attendance log not found', 404)`.

**Non-JSON responses**: The export route (`web/app/api/export/route.ts:247-252`) bypasses the JSON envelope entirely, returning a `NextResponse` with `Content-Type: text/csv` and a `Content-Disposition: attachment` header for file downloads.

**Ownership defense-in-depth**: When using the admin client (which bypasses RLS), routes re-assert ownership in application code. The attendance check-out handler (`attendance/route.ts:147-152`) verifies `existing.user_id !== user.id` before allowing the mutation, with a comment noting this is defense-in-depth against the admin client's RLS bypass.

## Auth, RBAC, and Security Model

The application enforces access control through five complementary layers: Supabase Row Level Security (RLS), in-route permission checks via the admin client, role-based helpers, field-level allowlists, and rate limiting. No single layer is sufficient on its own; each covers gaps in the others.

### The Two Supabase Clients

Every database interaction flows through one of three clients, and the distinction between them is load-bearing:

| Client | File | Key | RLS |
|--------|------|-----|-----|
| **Browser** | `web/lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enforced |
| **SSR** | `web/lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enforced |
| **Admin** | `web/lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | **Bypassed** |

`createAdminClient()` (`web/lib/supabase/admin.ts:3-13`) constructs a client with the service-role key and disables session persistence (`autoRefreshToken: false`, `persistSession: false`). This key is a Supabase superuser credential: it skips every RLS policy on the database. Consequently, any API route that uses the admin client **must** perform its own access checks in application code before querying or mutating data. The admin client is not optional or decorative; it is the path that every server-side route actually takes, because the admin client is the only one that can write across company boundaries when the server acts on behalf of an authenticated user. Forgetting an in-route check when using this client means the service-role key silently grants full database access.

The browser client (`web/lib/supabase/client.ts:3-7`) and SSR client (`web/lib/supabase/server.ts:4-24`) both use the anon key and therefore respect RLS. The SSR client additionally integrates with Next.js cookie handling for session refresh.

### Role Hierarchy

Roles are defined in a single source of truth: `web/lib/auth/rbac.ts:15-21`.

```
ROLE_HIERARCHY: Record<UserRole, number> = {
  client:       0,
  photographer: 1,
  foreman:      2,
  site_manager: 3,
  admin:        4,
}
```

Higher numeric level means more privilege. The derived helpers (`web/lib/auth/rbac.ts:31-53`) are cumulative "and above" checks:

| Helper | Condition | Defined at |
|--------|-----------|------------|
| `isAdmin(role)` | `role === 'admin'` | `rbac.ts:31` |
| `isManager(role)` | `site_manager` or `admin` | `rbac.ts:36` |
| `isForeman(role)` | `foreman`, `site_manager`, or `admin` | `rbac.ts:41` |
| `canWrite(role)` | delegates to `isForeman` | `rbac.ts:46` |
| `canManage(role)` | delegates to `isManager` | `rbac.ts:51` |
| `canAssignRole(assigner, target)` | admin may assign any; non-admin only strictly lower-level roles | `rbac.ts:72` |
| `roleLevel(role)` | returns numeric level or `-1` for unknown | `rbac.ts:62` |

These helpers are pure functions with no Supabase or React dependencies, so they can be imported from both server routes and client components.

### Role-to-Workspace Map

Workspace routing is defined in `web/lib/auth/workspace.ts:4-12`. The `Workspace` type is a union of five literal strings, each mapped to a route:

| Role | Workspace | Route |
|------|-----------|-------|
| `admin` | `admin` | `/admin` |
| `site_manager` | `manager` | `/dashboard/manager` |
| `foreman` | `field` | `/dashboard/worker` |
| `photographer` | `field` | `/dashboard/worker` |
| `client` | `client` | `/projects` |
| _(unknown/null)_ | `pending` | `/dashboard/pending-access` |

The mapping function `workspaceForRole` (`workspace.ts:14-23`) uses a switch that maps `foreman` and `photographer` to the same `field` workspace, and defaults any unrecognized role to `pending`. The `getCurrentWorkspace` function (`workspace.ts:26-39`) resolves the current user's workspace by reading their `role` from the `profiles` table through the RLS-bound SSR client.

### Company-Scoped Multi-Tenancy

Isolation between companies is enforced at the application layer through `web/lib/api/company-auth.ts`. The central type is `CompanyContext` (line 3):

```typescript
interface CompanyContext {
  companyName: string
  companyUserIds: string[]
  isAdmin: boolean
}
```

`getCompanyContext(db, userId)` (`company-auth.ts:9-42`) resolves a user's company membership by reading their `company_name` and `role` from `profiles`. For non-admin users, it fetches all user IDs sharing the same `company_name`, enabling downstream company-scoped queries. Admins receive an early return with an empty `companyUserIds` array, which signals to callers that company-scoped filtering should be skipped.

The guard functions compose company context with project-level checks:

- **`requireProjectAccess(db, userId, projectId, opts?)`** (`company-auth.ts:100-147`): Verifies the user may read a project. Admins bypass by default (`allowAdminBypass` defaults to `true`). Non-admins must be the project owner, in the owner's company, or hold an explicit `project.VIEW.<id>` grant in `user_permissions`. Throws `{ status: 403 }` with message `'Немате пристап до овој проект'` on failure.

- **`requireProjectMutate(db, userId, projectId)`** (`company-auth.ts:155-184`): Stricter write guard. A `project.VIEW` grant is **not** sufficient for mutation; the user must be the owner, in the owner's company, or an admin. This prevents privilege escalation from read-only cross-access grants (referenced as P1-7 in the source comment).

- **`requireProjectManager(db, userId, projectId)`** (`company-auth.ts:192-208`): Combines a role gate (`site_manager` or `admin` only) with `requireProjectMutate`. Used for manager-only operations like creating or canceling work orders.

- **`getAccessibleProjectIds(db, userId, ctx)`** (`company-auth.ts:69-98`): Resolves the set of project IDs a non-admin user may see in global queries. Returns the union of company-owned projects and any explicit `project.VIEW.<id>` grants. Company-less users with no grants receive an empty array.

- **`hasProjectAccessViaPermission(db, userId, projectId)`** (`company-auth.ts:44-57`): Checks the `user_permissions` table for a `project.VIEW.<id>` row with `granted === true`.

- **`requireLabelGroupAccess(db, userId, groupId)`** (`company-auth.ts:232-259`): Defense-in-depth (P2-4) for label group writes. Verifies the label group belongs to the caller's company by joining `label_groups.company_id` against `companies.id`. Admins bypass. RLS already enforces this at the database level, so this check converts a confused-role client error into a clean 403.

The `company_name` column on `profiles` and the join patterns (`owner.company_name = me.company_name`) appear in Supabase migrations as well. For example, `supabase/migrations/20260810000002_work_orders.sql:82,97` uses this exact company-name comparison in its RLS policies to enforce company-scoped access. The earlier migration `supabase/migrations/20260724000001_create_projects.sql:10-25` enables RLS on `projects` with `user_id`-based policies.

### Field Allowlists (Mass-Assignment Mitigation)

PATCH endpoints in the application do not accept arbitrary key-value bodies. `web/lib/api/field-whitelists.ts:8-25` defines two allowlists:

**`DAILY_LOG_UPDATE_FIELDS`** (`field-whitelists.ts:8-14`):
- `log_date`, `work_description`, `weather`, `temperature`, `notes`

**`PIN_UPDATE_FIELDS`** (`field-whitelists.ts:16-25`):
- `pin_type`, `x`, `y`, `width`, `height`, `color`, `label`, `drawing_data`

The `filterAllowedFields(updates, allowed)` function (`field-whitelists.ts:34-43`) iterates the allowed keys and copies matching values from the incoming `updates` object. Any key not in the allowlist is silently dropped. This prevents callers from writing protected columns such as `user_id`, `project_id`, or `created_at` through the update path.

### Rate Limiting

`web/lib/api/rate-limit.ts` implements an in-memory sliding-window rate limiter. Key details:

- **`checkRateLimit(identifier, config)`** (`rate-limit.ts:43-85`): Accepts a string identifier (typically the client IP) and a `RateLimitConfig { limit: number, windowMs: number }`. Returns a `RateLimitResult` with `success`, `limit`, `remaining`, `resetTimeMs`, and `retryAfterSec`.

- **`rateLimitResponse(result, customMessage?)`** (`rate-limit.ts:105-128`): Builds a `NextResponse` with status **429** and RFC-compliant headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. The default error message is in Macedonian: `'Премногу барања. Обидете се повторно за ${result.retryAfterSec} секунди.'`

- **`getClientIp(request)`** (`rate-limit.ts:90-100`): Extracts the client IP from `x-forwarded-for` (first entry) or `x-real-ip`, falling back to `'127.0.0.1'`.

The store is an in-memory `Map` that self-cleans every 5 minutes, evicting entries older than 10 minutes (`rate-limit.ts:10-25`).

### Audit Logging

`web/lib/audit.ts` defines a fire-and-forget audit trail. The `logAudit(params)` function (`audit.ts:53-70`) POSTs to `/api/audit-logs` (a server-side proxy that writes using the admin client, bypassing RLS). Failures are captured by the monitoring system and never thrown to the caller.

The tracked actions (`audit.ts:3-24`) cover the full entity lifecycle:

- **Project**: `project.created`, `project.updated`, `project.deleted`
- **Photo**: `photo.uploaded`, `photo.updated`, `photo.deleted`, `photo.viewed`
- **Daily Log**: `daily_log.created`, `daily_log.updated`
- **Defect**: `defect.created`, `defect.updated`, `defect.resolved`
- **Pin**: `pin.created`, `pin.updated`, `pin.deleted`
- **Attendance**: `attendance.check_in`, `attendance.check_out`
- **Report**: `report.generated`
- **Auth**: `user.login`
- **Profile**: `profile.updated`

Entity types (`audit.ts:28-37`) map to eight categories: `project`, `photo`, `daily_log`, `defect`, `pin`, `attendance`, `report`, `profile`.

### Security Headers

`web/next.config.ts:20-48` configures five security headers on all routes (`/(.*)`):

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://unpkg.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

The CSP allows `unsafe-inline` and `unsafe-eval` for scripts (required by Next.js), whitelists Supabase storage and OpenStreetMap tiles for images, and restricts connections to Supabase domains (including WebSocket for realtime).

### Defense-in-Depth Summary

The security model works as follows:

1. **RLS at the database layer**: Every table with user data has row-level policies enforced by Supabase. The anon-key clients (browser and SSR) cannot bypass these. Policies range from simple `auth.uid() = user_id` checks (early migrations like `20260724000001`) to company-scoped joins (later migrations like `20260810000002`).

2. **Admin client bypasses RLS**: The service-role client (`web/lib/supabase/admin.ts`) skips all RLS. Every route using this client must re-check access in application code. This is not an implementation detail; it is the central security invariant of the server layer.

3. **In-route permission checks**: Functions like `requireProjectAccess`, `requireProjectMutate`, and `requireProjectManager` enforce company scoping, ownership, and role requirements in application code before any database operation. These checks duplicate and extend what RLS provides, covering the gap left by the admin client.

4. **Role-based helpers**: The pure functions in `rbac.ts` gate UI and API behavior by role level. `canWrite`, `canManage`, and `canAssignRole` compose the hierarchy into reusable predicates.

5. **Field allowlists**: `filterAllowedFields` prevents mass-assignment of protected columns through PATCH endpoints. This is a defense against clients sending unexpected keys in update payloads.

6. **Rate limiting**: In-memory sliding-window limiter returning 429 with standard headers. Protects against abuse but is not a substitute for authorization.

7. **Audit trail**: All significant mutations are logged through `logAudit`, providing an append-only record of who did what and when.

8. **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy applied at the edge via Next.js middleware.

## Internationalization (i18n)

The application ships in five locales, configured via `next-intl`:

```ts
// web/i18n/routing.ts:3-7
locales: ['de', 'en', 'mk', 'sl', 'sr']
defaultLocale: 'mk'
localePrefix: 'as-needed'
```

Macedonian (`mk`) is the default locale and the source-of-truth for all user-facing copy. Five message catalogs live in `web/messages/`: `de.json`, `en.json`, `mk.json`, `sl.json`, and `sr.json`. The layout at `web/app/[locale]/layout.tsx:57` loads translations through `next-intl`'s built-in `getMessages()` helper (imported from `next-intl/server` at `layout.tsx:3`) and passes them into `<NextIntlClientProvider messages={messages}>` (line 101). There is no project-specific `getMessages` wrapper; the library resolves the correct catalog from the `[locale]` route segment automatically.

**Hard rule:** All user-facing strings must be written in Macedonian first and added to `mk.json` before translation into the other four catalogs. Code identifiers (variable names, function names, CSS classes, route segments) stay English.

## UI and Design System

### Design Tokens

`web/app/globals.css` defines a layered CSS custom property system. All color values use `oklch` and feed into Tailwind via the `@theme inline` block (`globals.css:7-63`). Key token families:

- **Surface layering:** `--background`, `--surface-raised`, `--surface-overlay`, `--surface-sunken` (lines 67-70) provide a four-level elevation hierarchy with warm unbleached-canvas tones in light mode and deep midnight blues in dark mode.
- **Foreground hierarchy:** `--foreground`, `--muted-foreground`, `--tertiary-foreground` (lines 73-75) establish three tiers of text contrast.
- **Accent palette:** `--accent`, `--accent-hover`, `--accent-muted` (lines 98-100) use a safety-amber hue (`oklch(... 55)`).
- **Radius scale:** `--radius-xs` through `--radius-pill` (lines 57-62), defined as `4px`, `6px`, `10px`, `16px`, `24px`, and `9999px`.

### Dark Mode

Dark mode is present. The `globals.css` file registers a dark variant via `@custom-variant dark (&:is(.dark *))` at line 5 and provides a full `.dark { ... }` token override block starting at line 131. Dark mode is toggled by applying the `.dark` class to an ancestor element.

### Component Primitives

`web/components/ui/` contains 15 component files (e.g., `button.tsx`, `dialog.tsx`, `card.tsx`, `input.tsx`, `skeleton.tsx`, `data-table.tsx`). The component library is a mix of two primitive bases:

- **Radix UI** is used for overlay/floating components. For example, `dialog.tsx:4` imports `@radix-ui/react-dialog`.
- **Base UI** (`@base-ui/react`) is used for lower-level interactive primitives. For example, `button.tsx:1` imports `Button as ButtonPrimitive from "@base-ui/react/button"`.

### Variant System and Class Merging

Components use `class-variance-authority` (`cva`) for variant definitions. The button component (`web/components/ui/button.tsx:2,6`) defines variants (`default`, `cta`, `secondary`, `outline`, `ghost`, `destructive`, `amberGhost`, `link`) and size variants (`xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`, `fab`) through `cva`. All components merge class strings through a `cn()` helper defined in `web/lib/utils.ts:5` as `twMerge(clsx(inputs))`, combining `clsx` conditional classes with `tailwind-merge` deduplication.

### Design Reference

`web/DESIGN.md` exists in the `web/` root and serves as the authoritative design-token reference for the project. Contributors should consult it for naming conventions, spacing rationale, and color semantics beyond what the CSS variables surface.

## Data Access

### Supabase Clients

Two Supabase client factories exist, split by rendering context:

- **Browser client** at `web/lib/supabase/client.ts` for client-side components that run in the browser.
- **SSR client** at `web/lib/supabase/server.ts` for server components and Next.js route handlers, which need cookies-aware session handling.

### Hook Pattern

Client components fetch data through dedicated hooks that encapsulate the Supabase query, loading state, and error handling. The pattern is established in `web/hooks/useDailyLogs.ts`:

1. The hook is marked `'use client'` (line 1).
2. It calls a query function imported from `@/lib/supabase/queries` inside a `useCallback` (line 17-29).
3. It maintains three pieces of state: `data` (typed results), `loading` (boolean), and `error` (string or null) via `useState` (lines 13-15).
4. A `useEffect` triggers the initial fetch when the hook mounts or its key parameter changes (lines 31-33).
5. It exposes a `refetch` function for manual re-fetching (lines 35-37).
6. The return value is a plain object: `{ logs, loading, error, refetch }` (line 39).

The following hooks follow this same pattern, each wrapping a specific query:

| Hook | File |
|------|------|
| `useAttendance` | `web/hooks/useAttendance.ts` |
| `useDailyLogs` | `web/hooks/useDailyLogs.ts` |
| `useDefects` | `web/hooks/useDefects.ts` |
| `useLabels` | `web/hooks/useLabels.ts` |
| `usePermissions` | `web/hooks/usePermissions.ts` |
| `usePins` | `web/hooks/usePins.ts` |
| `useRole` | `web/hooks/useRole.ts` |
| `useTrades` | `web/hooks/useTrades.ts` |
| `useWorkOrders` | `web/hooks/useWorkOrders.ts` |

**Canonical convention:** Pages and client components fetch data through these hooks, which wrap Supabase queries and manage their own state. Server components and route handlers use the appropriate Supabase client directly (`client.ts` or `server.ts`) imported from `@/lib/supabase`.

## Testing Conventions

### Framework and Configuration

Vitest with jsdom environment (`web/vitest.config.ts:6`). Test files use the `*.test.{ts,tsx}` glob (`web/vitest.setup.ts:1` loads `@testing-library/jest-dom`).

Run commands from `web/package.json`:
- `npm run test` — single run (CI gate)
- `npm run test:watch` — watch mode

### Test File Locations

Tests live in colocated `__tests__/` directories — never mixed into source files.

**Library / logic tests** (15 files): `web/lib/__tests__/`
Key examples:
- `attendance-invariants.test.ts` — pure-function models of DB constraints (partial unique index, CHECK constraints, 24h duration cap) tested without Supabase (`web/lib/__tests__/attendance-invariants.test.ts:27-50`)
- `dashboard.test.ts`, `risk-score.test.ts`, `time.test.ts` — business logic helpers
- `monitoring.test.ts` — MonitoringService behavior

**Route handler tests** (7 files): `web/app/api/__tests__/`
Key examples:
- `invite-route.test.ts` — mock Supabase chain via `vi.hoisted()` + `vi.mock('@supabase/ssr')`, fluent builder pattern (`web/app/api/__tests__/invite-route.test.ts:13-54`)
- `labels-routes.test.ts`, `schemas-route.test.ts` — similar mock-chain approach
- `export-route.test.ts` — non-JSON (CSV) response testing

### Test Patterns

**Invariant modeling**: `attendance-invariants.test.ts` expresses DB constraints (partial unique index, CHECK) as pure functions, then tests those functions directly — no DB connection needed.

**Fluent Supabase mock**: Route tests build a chainable mock (`db.from('table').select().eq().single()`) where the terminal call resolves to a handler map keyed by `table.single[:eqValue]`. This mirrors the real query-builder pattern without hitting Supabase.

**Mock registration**: Use `vi.hoisted()` for test-only constants and mock factories; `vi.mock()` for module-level stubs (e.g. `@supabase/ssr`).

## PDF / EXIF / Image / Monitoring Pipelines

### PDF Report Generation

`web/lib/pdf/generator.ts` — pdfkit-based A4 report generator.

- **Entry point**: `generateReport(outputPath, options)` returns the output path (`web/lib/pdf/generator.ts:174-177`)
- **Multilingual labels**: `LABELS` object covers mk/en/de/sr/sl (`web/lib/pdf/generator.ts:30-91`); default language is `mk`
- **Fonts**: DejaVuSans / DejaVuSans-Bold loaded from `public/fonts/` via `process.cwd()` (`web/lib/pdf/generator.ts:107-108`)
- **Image embedding**: sharp reads dimensions → ratio-scaled fit inside `IMG_MAX_WIDTH × IMG_MAX_HEIGHT` (100mm max height) (`web/lib/pdf/generator.ts:240-252`); failed images render a localized error placeholder
- **Footer pagination**: `drawFooters()` iterates `bufferedPageRange()` after all content is written, adding company name + "Page X / Y" (`web/lib/pdf/generator.ts:135-170`)

### EXIF Extraction

`web/lib/exif.ts` — wraps `exifr.parse()` with selective field extraction (`exif: true, gps: true; xmp/icc/iptc/tiff: false`) (`web/lib/exif.ts:16-24`).

Returns `ExifData { takenAt, latitude, longitude }`. Falls back to `file.lastModified` when no EXIF data is found (`web/lib/exif.ts:28-32`). Errors are caught and logged, never thrown (`web/lib/exif.ts:51-58`).

### Image Compression

`web/lib/image/compress.ts` — sharp-based JPEG compression.

Defaults: 2048px max dimension, quality 82, progressive JPEG (`web/lib/image/compress.ts:12-16`). Key behaviors:
- `rotate()` auto-orientates based on EXIF orientation (`web/lib/image/compress.ts:29`)
- `resize({ fit: 'inside', withoutEnlargement: true })` never upscales (`web/lib/image/compress.ts:30-33`)
- `withMetadata()` preserves EXIF data (GPS, timestamps) through compression (`web/lib/image/compress.ts:35`)

### Signed-URL Storage

`web/lib/storage/signed-url.ts` — Supabase Storage signed-URL generation with in-process caching.

- **Cache**: `Map<string, { url, expiresAt }>` keyed by `${expiresIn}:${path}`, with 60-second safety margin (`web/lib/storage/signed-url.ts:19-29`)
- **Batch signing**: `getSignedUrls()` uses `createSignedUrls` (single round-trip) for N photos, skipping cached entries (`web/lib/storage/signed-url.ts:143-194`)
- **SSRF defense**: `assertSafeStorageUrl()` enforces HTTPS + host match against `NEXT_PUBLIC_SUPABASE_URL` (`web/lib/storage/signed-url.ts:205-217`); `isProjectSchemaPath()` rejects `..` segments to prevent path traversal (`web/lib/storage/signed-url.ts:77-86`)
- **Fail-closed**: throws on invalid paths, never echoes attacker input back as URL (`web/lib/storage/signed-url.ts:108-111`)

### Monitoring

`web/lib/monitoring.ts` — `MonitoringService` singleton.

- `captureException(error, context)` — logs to console + dispatches to Sentry when DSN is configured; suppresses transmission errors to prevent cascading failures (`web/lib/monitoring.ts:35-60`)
- `captureMessage(message, level, context)` — diagnostic logging (`web/lib/monitoring.ts:65-73`)
- Initialized from `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` env vars (`web/lib/monitoring.ts:22-24`); disabled in test environment (`web/lib/monitoring.ts:39`)

### Data Export

`web/lib/export.ts` — client-side CSV download trigger. `downloadProjectCsv(projectId, type)` constructs the URL with `encodeURIComponent` and uses a hidden `<a>` element with `download` attribute (`web/lib/export.ts:10-18`). Supported types: `defects`, `photos`, `logs`, `work_orders`, `attendance` (`web/lib/export.ts:1`).

### Dashboard Constants

`web/lib/dashboard.ts` — named thresholds extracted for testability: `OPEN_DEFECT_STATUSES`, `RESOLVED_DEFECT_STATUSES`, `CRITICAL_SEVERITY`, fetch limits, and predicate helpers (`isOpenDefect`, `isCriticalDefect`) (`web/lib/dashboard.ts:16-66`).

## Do's

1. **Always validate mutations with Zod** — use `validateBody(schema)` in API routes; define schemas in `web/lib/api/schemas.ts` or `web/lib/validation/schemas.ts` (`web/lib/api/validate.ts:15-42`)
2. **Always call `requireAuth()` first** — it throws an `Error` with `.status` (not a plain object); wrap route handlers in `apiErrorResponse(e)` (`web/lib/api/auth-guard.ts:19-46`)
3. **Macedonian user-facing strings** — error messages, labels, and PDF report text must be in mk; code/identifiers stay English (`web/lib/pdf/generator.ts:30-42`)
4. **Use existing UI components** — `components/ui/` (shadcn/ui via @base-ui/react), design tokens from `globals.css` CSS variables, cva for variants (`web/app/globals.css:65-100`)
5. **Use existing hooks** — `useDailyLogs`, `useAttendance`, `useDefects`, `usePermissions`, `useRole`, `useWorkOrders` encapsulate fetch+state
6. **Test invariant logic as pure functions** — model DB constraints in JS, test without Supabase (`web/lib/__tests__/attendance-invariants.test.ts:27-50`)
7. **Use `toStoragePath()` before signing** — normalizes both URLs and raw paths; prevents SSRF via `assertSafeStorageUrl()` (`web/lib/storage/signed-url.ts:54-65, 205-217`)
8. **Filter PATCH fields through allowlists** — `filterAllowedFields(body, DAILY_LOG_UPDATE_FIELDS)` prevents mass-assignment (`web/lib/api/field-whitelists.ts`)

## Don'ts

1. **Don't bypass `requireAuth()`** — every API route must authenticate; no unauthenticated endpoints (except `GET /api/health`)
2. **Don't trust client-supplied role claims** — roles come from `company_members.role` via `getCompanyContext()`, never from request body (`web/lib/api/company-auth.ts`)
3. **Don't skip in-route permission checks** — `createAdminClient()` bypasses RLS, so code must manually verify access (`web/lib/supabase/admin.ts` + every admin-client route)
4. **Don't invent translations** — add new strings to `web/messages/mk.json` first; other catalogs are translations of mk
5. **Don't add dependencies without justification** — the stack is deliberately minimal; check `web/package.json` before adding
6. **Don't use `console.log` in production paths** — use `monitoring.captureMessage()` or `monitoring.captureException()` (`web/lib/monitoring.ts:35-73`)
7. **Don't write test files outside `__tests__/`** — colocate in `web/lib/__tests__/` or `web/app/api/__tests__/`

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|---|---|---|
| Mass-assignment on PATCH | Accepting all request body fields overwrites fields the caller shouldn't control | `filterAllowedFields(body, ALLOWLIST)` before DB update (`web/lib/api/field-whitelists.ts`) |
| Trusting client role claims | A user could claim `admin` in the request body | Read role from `getCompanyContext()` → `company_members.role` (`web/lib/api/company-auth.ts`) |
| Skipping `requireAuth()` | Exposes unauthenticated endpoints | Always call `requireAuth()` as the first line in every handler (`web/lib/api/auth-guard.ts:19`) |
| `console.error` for monitoring | Bypasses Sentry integration, no structured context | Use `monitoring.captureException(err, context)` (`web/lib/monitoring.ts:35-60`) |
| Inventing translations | mk catalog is source-of-truth; other catalogs must mirror it | Add to `web/messages/mk.json`, then translate (`web/i18n/routing.ts`) |
| Re-signing URLs on every request | N+1 storage API calls for photo lists | Use `getSignedUrls()` batch function with in-process cache (`web/lib/storage/signed-url.ts:143-194`) |
| Using `public` storage URLs directly | URLs leak after bucket policy changes | Convert to signed URLs via `getSignedUrl()` / `getSignedUrls()` (`web/lib/storage/signed-url.ts:103-133`) |
