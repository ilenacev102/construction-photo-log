# Performance Audit — Фото Градежен Дневник

**Date:** 2026-07-31
**Scope:** `web/` (Next.js 16.2.11, React 19, Tailwind 4, Supabase, next-intl)
**Type:** Read-only source audit (no build/dev/profiling run; no files modified)
**Basis:** Full source review of `components/**`, `hooks/**`, `app/api/**`, `lib/**`, `app/[locale]/**`, `app/layout.tsx`, `next.config.ts`, `proxy.ts`. Excluded embedded `wedding-planner/`.

---

## 1. Executive Summary

The application is **functionally complete and structurally sound** — auth, permissions, plan limits, tagging integrity, and the PDF pipeline are implemented correctly. No P0 security/availability defects were found; the `execSync`/command-injection concern (L16) is **absent** from the current codebase.

The remaining issues are **client-side performance and scale** problems, not correctness:

1. **Images are never optimized.** 13 raw `<img>` tags, zero `next/image` usage, zero width/height, zero `loading="lazy"`. Photos are compressed once at upload (2048px, q82) and served at full resolution even in 300px grid cells. No thumbnails, no srcset.
2. **Unbounded list fetches.** `/api/photos` and `/api/defects` have **no pagination limit** in their project-less (dashboard) branches; the worker dashboard pulls *every company photo and defect* into the client. Signed URLs are regenerated on every page load (no stable cache key), so grids re-download on each visit.
3. **Sequential + N+1 patterns.** Report generation downloads up to 100 photos **sequentially**; daily-log timelines issue one `/api/taggings` request **per log in a for-await loop**; team listing runs a per-user permission query loop.
4. **Leaflet is statically bundled** into project pages (150KB+ lib + CSS + unpkg CDN marker icons) even when the map tab is never opened.
5. **Duplicate fetches:** `DefectBoard` calls `useLabels()` twice; `useRole()` runs in Navbar *and* every page (2× `getUser` + `/api/users` per route); project layout and detail page both fetch the same project.

**Verdict:** Not release-blocking on correctness, but **P1 items should be addressed before public launch** (image optimization, list pagination, report-download parallelism). Details and fixes in §3–§5.

---

## 2. Findings Table

| # | Severity | Area | Finding | File:Line evidence |
|---|----------|------|---------|--------------------|
| F1 | **P0** | Images | No next/image, no width/height/lazy, no thumbnails/srcset; full-res images in grids | 13 `<img>` in 9 files; 0 `next/image`, 0 `loading=`/`decoding=` in `web/` |
| F2 | **P0** | Lists | `/api/photos` + `/api/defects` unbounded in dashboard branch; all rows → client | `app/api/photos/route.ts:20`, `app/api/defects/route.ts:22` |
| F3 | **P1** | Report | Up to 100 photos downloaded **sequentially** with sync fs writes | `app/api/report/route.ts:41-56` |
| F4 | **P1** | Bundle | Leaflet statically imported (lib + CSS + unpkg CDN icons) on every project page | `components/PhotoMap.tsx:1-9`, `projects/[id]/page.tsx:7` |
| F5 | **P1** | N+1 | Per-log `/api/taggings` fetch in sequential for-await loop | `components/DailyLogTimeline.tsx` |
| F6 | **P1** | N+1 | Per-user permission query loop in team listing | `app/api/team/route.ts` |
| F7 | **P1** | Duplicate fetch | `useLabels()` invoked twice in one component | `components/DefectBoard.tsx:53,143` |
| F8 | **P1** | Duplicate fetch | `useRole()` in Navbar + page → 2× `getUser` + 2× `/api/users` per route | `components/Navbar.tsx`, `hooks/useRole.ts` |
| F9 | **P2** | Memory | ObjectURL never revoked (photo previews) | `components/PhotoUpload.tsx:34`, `schema/page.tsx:126`; 0 `revokeObjectURL` in repo |
| F10 | **P2** | Correctness | `PhotoCard` hardcodes `mk` date-fns locale; root layout loads Inter `latin` subset only (Cyrillic falls back) | `components/PhotoCard.tsx`, `app/layout.tsx` |
| F11 | **P2** | Duplicate fetch | Project layout + detail page both call `getProject(id)`; detail + photos page both fetch photos | `projects/[id]/layout.tsx:27`, `projects/[id]/page.tsx`, `projects/[id]/photos/page.tsx` |
| F12 | **P2** | Minor | Navbar `navLinks` contains duplicate `/dashboard` entry | `components/Navbar.tsx` |

---

## 3. Detailed Findings

### F1 — Images never optimized (P0)

**Evidence:**
- `grep '<img'` → 13 matches across 9 files: `schema/page.tsx`(5), `ReportBuilder`(1), `PhotoLightbox`(1), `DrawingCanvas`(1), `PhotoCard`(1), `PhotoUpload`(1), `worker/page.tsx`(1), `projects/[id]/page.tsx`(1), `pins/page.tsx`(1).
- `grep 'next/image'` → **0 matches** in `web/` (only in excluded `wedding-planner/`).
- `grep 'loading=\|decoding='` → **0 matches**. No `width`/`height` on any `<img>`.
- Upload pipeline compresses once to 2048px/q82/progressive (`lib/image/compress.ts`) — good for storage, but the same 2048px file is served to a 280px grid cell.
- `next.config.ts` **already** has `images.remotePatterns` covering Supabase storage; `proxy.ts` already exempts `/_next/image`. The infra is ready — the components just never adopted `next/image`.

**Impact:** Largest single page-weight driver. A 100-photo timeline = 100 full-res JPEGs (~300–600 KB each → 30–60 MB) on one page; browser re-fetches on each visit because signed URLs are regenerated (see F2).

**Fix (top priority):**
1. Replace `<img>` with `next/image` (sizes + `quality`), using the existing Supabase `remotePatterns`. Width/height or `fill` + `sizes` to kill CLS.
2. Better: generate a **thumbnail variant at upload time** (e.g. 320px q70) and serve `_thumb` for grids/timeline, full-res only in lightbox. Single pipeline change in `compressImage`, zero per-request cost.
3. Add `loading="lazy"` + `decoding="async"` on below-fold grids (or `next/image` handles it).
4. Set cache headers on the signed-URL response (or long-lived signed URLs + `immutable`), so browsers don't re-download identical images.

### F2 — Unbounded list fetches (P0)

**Evidence:**
- `app/api/photos/route.ts:20` — dashboard branch: `select('*').order('taken_at', {ascending: false})` — **no `.limit()`**. Signed URLs then generated for *every* row via `Promise.all` (parallel, but unbounded).
- `app/api/defects/route.ts:22` — dashboard branch: `select('*').order(...)` — **no `.limit()`**.
- `dashboard/worker/page.tsx:40-45` fetches `/api/photos` (all company photos), `/api/defects` (all), `/api/attendance?limit=200` on mount.
- `dashboard/manager/page.tsx` fetches `/api/attendance?limit=200` + `/api/defects` + stats + audit.
- `RoleDashboard`, `DefectBoard` render full arrays client-side.

**Impact:** O(company photos) requests + O(n) signed URLs + O(n) DOM nodes per dashboard load. Degrades linearly with data volume.

**Fix:**
- Add `limit`/`offset` (or cursor) pagination to photos & defects routes; default 50, max 200 (matches existing attendance pattern).
- Dashboard grids → paginate or virtualize (e.g. incremental "load more" or infinite scroll).
- Worker dashboard only needs: my last N photos, open defect count, today's team check-ins — add targeted queries (`limit: 5`, count via `head: true`) instead of pulling everything.

### F3 — Sequential report download (P1)

**Evidence:** `app/api/report/route.ts:41-56` — `for (const photo of photos) { signedUrl → fetch → fs.writeFileSync }`, up to 100 iterations, fully serial. Then `generateReport` (pdfkit) runs.

**Impact:** Report request time ≈ 100 × (signed-URL RTT + image fetch RTT + disk write). On a typical 20–50ms backend RTT this is 5–10s; with storage latency, worse. Serverless functions have wall-clock limits — a 100-photo report can time out.

**Fix:** `await Promise.all(photos.map(parallel-download))` with a concurrency cap (e.g. `p-limit`-style chunk of 10–15). Keep `writeFileSync` per file (independent paths are safe) or use async fs. Budget check: cap report photo count is 100 — fine.

### F4 — Leaflet statically bundled (P1)

**Evidence:** `components/PhotoMap.tsx:1-9`:
```
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet/dist/leaflet'? defaultIcon with unpkg URLs
```
- Static imports → leaflet (~150KB gz ~42KB + CSS + marker PNGs) lands in the shared project-page chunk.
- `projects/[id]/page.tsx:7` statically imports `PhotoMap` → bundled even when the user never opens the map tab.
- Marker icons loaded from **unpkg CDN at runtime** — external network dependency, breaks offline/CSP-strict setups, and contradicts the vault preference "dynamic import for leaflet."

**Fix:**
1. `const PhotoMap = dynamic(() => import('@/components/PhotoMap'), { ssr: false })` in the project detail page, rendered only when `view === 'map'`.
2. Self-host the marker icons (copy into `public/` and point `L.Icon.Default` at local URLs) or use `L.divIcon`/inline SVG — removes the CDN dependency.
3. Optionally gate the CSS import to the dynamic chunk.

### F5 — Per-log taggings N+1 (P1)

**Evidence:** `components/DailyLogTimeline.tsx` — for each `daily_log`, `await fetch('/api/taggings?taggable_type=daily_log&taggable_id=' + log.id)` in a **sequential for-await loop** (confirmed by read of the component).

**Impact:** A project with 50 daily logs → 50 sequential round-trips. With per-request auth + RLS overhead, this is the slowest list view in the app.

**Fix (preferred):** Backend — add a batched GET to `/api/taggings` accepting multiple `taggable_id`s (`?taggable_type=daily_log&ids=a,b,c`), one query with `.in()`. Client — single fetch + group by id.

### F6 — Team listing N+1 (P1)

**Evidence:** `app/api/team/route.ts` — builds the member list, then loops per user to fetch their permission rows (`select('*')`), producing N+1 queries per request (from the earlier route read).

**Fix:** Single query for all permission rows for the member set (`in('user_id', ids)`), join client-side. Also drop `select('*')` to the needed columns.

### F7 — Duplicate `useLabels()` in DefectBoard (P1)

**Evidence:** `components/DefectBoard.tsx:53` and `:143` — two `useLabels()` calls in the same component tree. Each `useLabels()` mounts an independent effect that fetches `/api/labels/groups`. DefectBoard renders both → 2 identical network requests.

**Fix:** Call `useLabels()` once in `DefectBoard` and pass `groups` down to the modal; or lift to a context/provider (fixes F8 too).

### F8 — `useRole()` runs per component, no caching (P1)

**Evidence:** `hooks/useRole.ts` — each call does `supabase.auth.getUser()` **and** `fetch('/api/users?userId=…')`. 13 files call `useRole()` (Navbar, RoleDashboard, DefectBoard, AttendancePanel, DrawingCanvas, admin layout, 7 pages). `components/Navbar.tsx` + every page → **2× auth + 2× users lookup per route**. No React context/provider, no `React.cache()`, no SWR. `grep useMemo(` → **0 matches** in `web/`.

**Impact:** Every route pays duplicate auth + role lookups; worse on dashboards where Navbar + page + inner components each call it.

**Fix:** Wrap in a `RoleProvider` context at `[locale]/layout` (or `React.cache()` server-side helper for server components); expose `useRole()` that reads context. One `getUser` + one `/api/users` per route.

### F9 — ObjectURL leaks (P2)

**Evidence:** `components/PhotoUpload.tsx:34` and `app/[locale]/projects/[id]/schema/page.tsx:126` create `URL.createObjectURL(file)`; **zero** `revokeObjectURL` in the entire repo. Previews leak memory until tab close.

**Fix:** `useEffect` cleanup / `onSuccess` → `URL.revokeObjectURL(previewUrl)`.

### F10 — Locale/font nits (P2)

- `components/PhotoCard.tsx` — `format(…, { locale: mk })` hardcoded; app supports 5 locales (mk/en/de/sl/sr). Should use `useLocale()`.
- `app/layout.tsx` — `Inter({ subsets: ['latin'] })` only; Macedonian Cyrillic renders via system fallback (FOUT/subset misses). Add `'cyrillic'` subset.

### F11 — Redundant project/photo fetches (P2)

- `projects/[id]/layout.tsx:27` fetches the project; `projects/[id]/page.tsx` fetches it again.
- Detail page fetches photos for the map; the photos tab re-fetches all photos.

**Fix:** Pass data via RSC or a shared context; at minimum parallelize and dedupe with a tiny cache layer (`React.cache()` on the server query helpers).

### F12 — Navbar duplicate link (P2)

- `components/Navbar.tsx` — `navLinks` contains two entries with `href: '/dashboard'`. Cosmetic.

---

## 4. Top-5 Ranked Fixes

| Rank | Fix | Effort | Impact |
|------|-----|--------|--------|
| 1 | **Thumbnails + `next/image`** (F1) | Medium (upload pipeline + component swap) | 10–30× page-weight reduction on photo-heavy pages; kills CLS |
| 2 | **Pagination on photos/defects routes** (F2) | Small | Linear degradation → bounded; dashboard stays fast at any data volume |
| 3 | **Parallelize report downloads with concurrency cap** (F3) | Small | 5–10× faster report generation; avoids serverless timeouts |
| 4 | **Role context + single `useLabels`** (F7+F8) | Small–Medium | Removes 2–4 duplicate network calls per route; consistent auth state |
| 5 | **Dynamic leaflet import + local icons** (F4) | Small | Drops ~150KB from project pages; removes CDN dependency |

---

## 5. Prior-Claim Verification Table

Audited from source (grep + full file reads). All 14 claims checked.

| Claim | Status | Evidence |
|-------|--------|----------|
| **H17** — client fetches lack AbortController/timeout | ⚠️ **STILL OPEN** | `grep AbortController` → 0 matches in `web/`. All hooks/pages use raw `fetch`; unmount guarded by `ignore`/`cancelled` flags only (good), no timeout/abort. `useDefects` has duplicated load paths (callback + effect). |
| **H22** — 13 `<img>` / no `next/image` | ✅ **CONFIRMED** | Exactly 13 `<img>` in 9 files; 0 `next/image`; 0 `loading`/`decoding`. Infra (`remotePatterns`, proxy exemption) present but unused. |
| **H26** — photos API no limit | ✅ **CONFIRMED** | `app/api/photos/route.ts:20` — dashboard branch has no `.limit()`. |
| **M13** — duplicate fetches in DefectBoard | ✅ **CONFIRMED** | `useLabels()` at DefectBoard.tsx:53 and :143 → 2× `/api/labels/groups`. |
| **M14** — duplicate fetches (Navbar+page) | ✅ **CONFIRMED** | `useRole()` in Navbar + every page → 2× auth + 2× `/api/users`. |
| **M17** — lightbox body-scroll not locked | ✅ **FIXED / present** | `PhotoLightbox.tsx:83-86` — `overflow='hidden'` in effect with cleanup resetting to `''`; touch handlers present. |
| **M22** — ObjectURL never revoked | ✅ **CONFIRMED** | `PhotoUpload.tsx:34`, `schema/page.tsx:126`; `grep revokeObjectURL` → 0 matches. |
| **M29** — fetch-all in dashboards | ✅ **CONFIRMED** | Worker dashboard fetches all photos + all defects; defects/photos routes unbounded. |
| **M30** — DrawingCanvas `preserveAspectRatio` distortion | ✅ **REFUTED / intentional** | `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` with **percentage coordinates** (`getRelativePos` → %) — correct pattern for percent overlays; shapes are not distorted relative to the coordinate system. |
| **M31** — client/server boundary | ✅ **CONFIRMED** | 22 `'use client'` files in `app/`; `schema/page.tsx` is a 25k+ char client page with 5 `<img>`; dashboard/manager, worker all client-heavy. |
| **M32** — no cache layer | ✅ **CONFIRMED** | 0 `useMemo`, no SWR/react-query/Redis; every route re-fetches on mount; `server.ts` uses no `React.cache()`. |
| **M34** — N+1 in team + taggings | ✅ **CONFIRMED** | `team/route.ts` per-user permission loop; `DailyLogTimeline` sequential per-log taggings fetch; taggings GET is single-id. |
| **H32** — hooks fetch patterns | ⚠️ **PARTIAL** | All hooks use `ignore` unmount guards (good) and sensible deps; but `useDefects` duplicates logic (callback + effect), none have abort/timeout, `usePins` direct supabase queries unthrottled. |
| **L16** — execSync / command injection | ✅ **FIXED / ABSENT** | `grep 'execSync\|child_process\|spawn'` in `app/` + `lib/` → 0 matches. PDF generation is pure pdfkit (`lib/pdf/generator.ts:125 generateReport`). |

---

## 6. Verdict

**P0 (block release):**
- None — no correctness, security, or availability blockers found.

**P1 (fix before public launch):**
- F1 Image optimization (thumbnails + `next/image`) — biggest user-visible win.
- F2 List pagination on photos/defects routes + dashboard queries.
- F3 Parallel report downloads (concurrency-capped).
- F4 Dynamic leaflet import + self-hosted marker icons.
- F5–F8 N+1 and duplicate-fetch elimination (taggings batch, team query, single `useLabels`, RoleProvider).

**P2 (post-launch polish):** F9–F12 (ObjectURL revoke, locale/font, dedupe project fetches, navbar link).

**Overall:** The architecture (signed URLs, service-role separation, plan limits, permission checks, Sharp pipeline, audit trail, paginated audit logs) is production-quality. The performance work is concentrated and mechanical — the top-5 fixes are all local, low-risk changes with the existing infra already in place.
