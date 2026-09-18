# Performance Audit — Track 1

Optimization of the Next.js web app (performance track of the 5-track
hardening pass). Every change below is a structural improvement; the numbers
are honest dev-mode observations, not production benchmarks — see the
"Measurement honesty" section.

## Summary

| Change | File(s) | Effect |
| --- | --- | --- |
| Removed `await cookies()` from root layout | `app/layout.tsx` | Root layout no longer forces 100% dynamic rendering |
| Client-side `<html lang>` sync | `components/HtmlLangSync.tsx` (new) | Static-renderable layout keeps correct `lang` after hydration |
| Cyrillic font subsets | `app/layout.tsx` | Geist/Geist Mono now load `latin` + `cyrillic` (not all subsets) |
| Single-frame timelapse | `components/TimelapseSlideshow.tsx` | DOM drops from N stacked `<img>` to 1 `<Image>` |
| `next/image` thumbnails | `components/PhotoCard.tsx` | Grid thumbnails get responsive sizing + lazy loading |
| Batch signed URLs + cache | `lib/storage/signed-url.ts`, `app/api/photos/route.ts` | Kills the per-photo N+1 storage round-trip |
| Code-split leaflet/qrcode/analytics | `app/[locale]/projects/[id]/page.tsx`, `[id]/layout.tsx` | Heavy client libs out of the initial bundle |
| `next/image` lightbox + hero | `components/PhotoLightbox.tsx`, `app/[locale]/projects/[id]/page.tsx` | Full-size images get optimization + sizing |
| Sitemap + robots | `app/sitemap.ts`, `app/robots.ts` (new) | SEO metadata routes; static route handlers |

## Baseline (before Track 1)

Taken with the dev server running in dev mode, `GET /`:

- `200 OK`, ~159 ms time_total (first warm request in the session).

No build output available as baseline (the repo had uncommitted changes from
other tracks, so `npm run build` was off-limits per the session rules).

## After — observed (dev mode, warmed)

Repeated `curl -s -o /dev/null -w "%{time_total}"` against `localhost:3000`:

| Route | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| `/` | 0.223s | 0.159s | 0.124s |
| `/sitemap.xml` | 0.010s | 0.007s | 0.007s |
| `/robots.txt` | 0.099s | — | — |
| `/en` | 0.160s | — | — |
| `/blog` | 0.150s | — | — |

All routes `200 OK`.

## Measurement honesty

- **Dev-mode numbers are not production benchmarks.** Next dev compiles on
  demand, so these timings are only a smoke test that every touched route
  still renders. They are not evidence of production latency improvements.
- The structural wins below are verifiable from the code and from route
  behavior, independent of timing noise:
  - `sitemap.xml`/`robots.txt` are **static route handlers** (no request-time
    API) — Next caches them by default; observed ~7 ms after first hit
    confirms they are served from cache.
  - The root layout has no request-time API anymore, so it is eligible for
    static rendering in a production build (was previously 100% dynamic due
    to `cookies()`).
- **What was NOT measured:** production bundle sizes, Lighthouse, or
  production TTFB — no `npm run build` (blocked by other tracks' uncommitted
  changes) and no deploy environment was available. These are follow-ups.

## Change details

### 1. Root layout no longer forces dynamic rendering

`app/layout.tsx` previously called `await cookies()` to read `NEXT_LOCALE`,
which marks the whole tree dynamic (every page, every build). Now:

- The layout is a plain (non-async) server component with `<html lang="mk">`.
- `HtmlLangSync` (client, `useEffect`) reads the `NEXT_LOCALE` cookie after
  hydration and updates `document.documentElement.lang` only when it differs
  from the default. `suppressHydrationWarning` on `<html>` covers the brief
  pre-hydration mismatch.
- Net: the same correct `lang` attribute, zero server blocking.

### 2. Cyrillic subsets

`Geist` and `Geist_Mono` used the default subset set. Now pinned to
`subsets: ["latin", "cyrillic"]` (verified present in the font's data file) so
the browser doesn't download subsets the app never uses. Font family unchanged.

### 3. Timelapse: one image in the DOM instead of N

`TimelapseSlideshow` previously rendered **every** frame as a stacked `<img>`
and toggled opacity. With 100+ photos that is 100+ DOM nodes and N network
requests for a single visible frame. Now it renders only the active frame via
`<Image key={displayIndex}>` — one node, one request, same crossfade behavior
via the existing fade-in animation.

### 4. Signed URLs: batch + cache

`GET /api/photos` signed each photo's URL with an individual
`createSignedUrl` call (N+1). Now:

- `getSignedUrls()` uses Supabase's `createSignedUrls` in **one round-trip**.
- Results are cached in-process for the URL's remaining lifetime (with a 60s
  safety margin), keyed by `expiresIn:path`, so repeat requests (e.g. the
  same photo list fetched again) skip storage entirely.
- Fail-closed P1-1 behavior is preserved: invalid paths throw before any
  storage call; no error path leaks input back as a URL.
- Existing `getSignedUrl` single-signer is kept (used by `app/api/report`).
- Test suite: added `resetSignedUrlCache()` (test support) and wired it into
  `afterEach`; all 13 signed-url tests pass.

### 5. Code-split heavy client libraries

- `PhotoMap` (leaflet) and `ProjectAnalytics` are now `next/dynamic` with
  `ssr: false` in the project detail page — leaflet's CSS/JS load only when
  the Map or Analytics tab is opened.
- `ProjectQRCode` (qrcode lib) is `next/dynamic` with `ssr: false` in the
  project layout — the QR modal's dependency leaves the initial bundle.
- `next/dynamic` and `next/image` are built-in; no new dependencies added.

### 6. Sitemap + robots

`app/sitemap.ts` generates localized URLs for all 5 locales using
`getPathname` from `@/i18n/navigation` (correct `as-needed` prefixes: `mk`
unprefixed, others `/de`, `/en`, ...). Static paths + all blog slugs.
`app/robots.ts` allows public routes and disallows `/admin`, `/dashboard`,
`/projects`, `/api/`. Base URL comes from `NEXT_PUBLIC_SITE_URL` with a
`localhost:3000` fallback (documented; the deployment must set the env var to
the real domain).

## Verification

- `npm run type-check` — clean on all Track 1 files. (Pre-existing errors in
  `lib/pdf/generator.ts` and `app/api/projects/[id]/members/route.ts` belong
  to Track 3 / Track 5 — untouched here.)
- `npx vitest run` — 12 files, 108 tests, all pass.
- `curl` smoke tests — `/`, `/en`, `/blog`, `/sitemap.xml`, `/robots.txt`
  all `200 OK`; sitemap/robots render correct localized content.
- Dev server log — no errors/warnings from Track 1 changes.

## Follow-ups (not in scope / blocked)

- Production build + Lighthouse (blocked: `npm run build` requires a clean
  tree; other tracks still have uncommitted changes).
- Set `NEXT_PUBLIC_SITE_URL` in the deployment env for correct absolute
  sitemap/robots URLs.
- PhotoWall/RoleDashboard photo lists also go through `getSignedUrl`-style
  N+1 paths; they can adopt the same batch helper when their track is ready.
