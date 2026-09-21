# Frontend Audit — 2026-08-17

> **Scope**: Read-only audit of `web/` (Next.js 16 App Router, React 19, Supabase, next-intl 5 locales, Stripe).
> **Baseline**: Builds on `AUDIT-REPORT.md` (Jul 29) and `REVIEW-FINAL-2026-08-10.md` (Aug 10).
> **Method**: Parallel deep exploration of app router tree, components/hooks, forms/a11y, data-fetching, and performance/i18n/dark-mode.

---

## Severity Legend

| Rating | Meaning |
|--------|---------|
| **P0** | Blocking — security vulnerability, complete feature failure, or data loss risk |
| **P1** | High — significant UX/accessibility break, performance regression, or data integrity risk |
| **P2** | Medium — degraded experience, missing best practice, or partial feature gap |
| **P3** | Low — code hygiene, minor UX inconsistency, or missing polish |
| **P4** | Info — observation, suggestion, or non-blocking improvement |

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| **P0** | 4 | Security, i18n, dark mode |
| **P1** | 10 | a11y, data integrity, hooks, performance |
| **P2** | 14 | Routing, a11y, i18n, performance, forms |
| **P3** | 13 | Code hygiene, minor UX, minor a11y |
| **P4** | 4 | Observations, suggestions |

---

## P0 — Critical (4)

### P0-1 · XSS via `dangerouslySetInnerHTML` in CommentItem

**File**: `web/components/comments/CommentItem.tsx:75`
**Finding**: Comment body rendered via `dangerouslySetInnerHTML={{ __html: comment.body }}`. User-supplied HTML is injected directly into the DOM with no sanitization, enabling stored XSS if any user can post `<script>`, event handlers, or SVG-based payloads.
**Prior audit**: Not previously reported.
**Fix**: Sanitize with DOMPurify before rendering: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.body) }}`. Alternatively, switch to a Markdown renderer (e.g., `react-markdown`) and remove raw HTML support entirely.

### P0-2 · CommentItem entirely hardcoded in Macedonian

**File**: `web/components/comments/CommentItem.tsx:31,56-59,61,72,108,118`
**Finding**: 6 hardcoded Macedonian strings make this component non-functional for 4/5 locales:
- Line 31: `window.confirm('Дали сте сигурни дека сакате да го избришете овој коментар?')`
- Lines 56-59: Entire `formatTime` function with Macedonian relative time ("Токму сега", "пред X минута/и", "пред X час/а", "пред X ден/а")
- Line 61: `toLocaleDateString('mk-MK', ...)` forces Macedonian locale
- Line 72: `'Непознат'` (Unknown)
- Line 108: `'Одговори'` (Reply)
- Line 118: `'Избриши'` (Delete)
**Prior audit**: Not previously reported.
**Fix**: Replace all strings with `useTranslations('commentItem')` calls. Add missing keys to all 5 locale JSON files. Use `useIntl()` or `useLocale()` for date/time formatting.

### P0-3 · Dark mode CSS exists but is unreachable

**File**: `web/app/globals.css:5,131-184`
**Finding**: 100% of dark mode CSS infrastructure is in place — design tokens (`.dark` variables at lines 131-184), component-level `dark:` Tailwind variants across 13+ files, and the variant strategy configured (`@custom-variant dark (&:is(.dark *))`). However, there is **zero runtime infrastructure**: no `ThemeProvider`, no toggle UI, no persistence mechanism, no class toggling on `<html>`. Dark mode is decorative dead code that can never be activated.
**Prior audit**: Not previously reported.
**Fix**: Create a `ThemeProvider` context that toggles `.dark` on `<html>`, add a toggle to the Navbar, persist in `localStorage` + cookie, add `suppressHydrationWarning` init script in `<head>`.

### P0-4 · No theme preference persistence

**File**: N/A (missing implementation)
**Finding**: No `localStorage` read/write, no `NEXT_THEME` cookie, no database preference, no `prefers-color-scheme` media query. Even if the toggle from P0-3 were added, preference would not survive page reload.
**Prior audit**: Not previously reported.
**Fix**: Implement alongside P0-3 — `localStorage.setItem('theme', ...)` on toggle, cookie for SSR matching, `prefers-color-scheme` as default for new users.

---

## P1 — High (10)

### P1-1 · No skip-to-content link

**Finding**: No `SkipLink` or `<a href="#main">Skip to content</a>` exists in the app. Screen-reader and keyboard users must tab through the entire navbar on every page load before reaching content.
**Prior audit**: Not previously reported.
**Fix**: Add a visually-hidden skip link as the first focusable element in the root layout: `<a href="#main" className="sr-only focus:not-sr-only ...">Skip to content</a>`.

### P1-2 · Color-only status/severity indicators

**Files**: `web/components/defects/DefectCard.tsx`, `web/lib/defect-utils.ts`, `web/components/RoleDashboard.tsx:109-116`, `web/components/DailyLogTimeline.tsx:41-45`
**Finding**: Status and severity indicators rely exclusively on background color (e.g., `bg-red-500` for critical, `bg-amber-500` for warning). No text labels, icons, or patterns supplement the color. This fails WCAG 1.4.1 (use of color) — users with color-vision deficiency cannot distinguish states.
**Prior audit**: Not previously reported.
**Fix**: Add text labels (e.g., "Critical" badge) or icons alongside color. Use `StatusBadge` pattern with both color + text.

### P1-3 · CommentForm textarea missing visible label

**File**: `web/components/comments/CommentForm.tsx:33`
**Finding**: `<textarea ... placeholder={t('placeholder')} ...>` has no `<label>` or `aria-label`. The placeholder serves as the only visible identifier, which disappears on focus. Fails WCAG 1.3.1 and 4.1.2.
**Prior audit**: Not previously reported.
**Fix**: Add `<label htmlFor="comment">{t('label')}</label>` (can be visually hidden via `sr-only` if desired).

### P1-4 · No client-side Zod validation on forms

**Files**: `web/components/auth/AuthForm.tsx`, `web/components/DailyLogForm.tsx`, `web/components/defects/DefectCreateModal.tsx`, `web/components/comments/CommentForm.tsx`
**Finding**: All forms use either bare HTML5 `required` attributes or custom `onSubmit` validation with no Zod schemas. Error messages are imperative strings, not structured. The shared `useFormValidation` hook uses imperative DOM manipulation (`element.focus()`, `setCustomValidity`). No `zodResolver` integration exists.
**Prior audit**: Not previously reported.
**Fix**: Add Zod schemas for each form, integrate via `zodResolver` with react-hook-form. This provides type-safe validation, consistent error messages, and locale-ready error keys.

### P1-5 · DailyLogForm silently swallows errors

**File**: `web/components/DailyLogForm.tsx:128-129`
**Finding**: The `catch` block calls `toast.error(message)` but `console.error(err)` is commented out, and the error is never re-thrown or surfaced to the form state. Users see a toast but the form doesn't reflect the failure — no error state, no field-level errors.
**Prior audit**: Not previously reported.
**Fix**: Set form error state from the catch block. Consider using react-hook-form's `setError` to surface server-side validation errors on specific fields.

### P1-6 · DefectCreateModal has no error display

**File**: `web/components/defects/DefectCreateModal.tsx:131-134`
**Finding**: On mutation failure, `toast.error` is called but the error is not displayed inline in the modal. If the toast auto-dismisses, the user has no persistent feedback about what failed. The modal stays open in its pre-submission state.
**Prior audit**: Not previously reported.
**Fix**: Add an error banner inside the modal that persists until the next submission attempt or modal close.

### P1-7 · `usePins` race condition on mount

**File**: `web/hooks/usePins.ts:37-38`
**Finding**: The `useEffect` that fetches pins depends on `[projectLocationId]` but also references `project.id` inside the effect. If `project.id` changes before the fetch completes, the stale closure serves data from the wrong project. The abort controller cancels the request but doesn't clear the state from the old response.
**Prior audit**: Not previously reported.
**Fix**: Add a `useRef` for a request counter — only update state if the counter matches the latest request. Or use React Query for automatic deduplication.

### P1-8 · `useTrades` stale closure on refetch

**File**: `web/hooks/useTrades.ts:39`
**Finding**: `fetchTrades` is defined with `useCallback` but the effect depends on `[fetchTrades]`. Since `fetchTrades` is recreated on every render (the callback deps may not be stable), this can cause infinite refetch loops or stale data.
**Prior audit**: Not previously reported.
**Fix**: Use React Query (`useQuery`) for data fetching to get automatic caching, dedup, and stale-while-revalidate semantics. Alternatively, stabilize the callback with proper deps.

### P1-9 · N+1 data fetching in DailyLogTimeline

**File**: `web/components/DailyLogTimeline.tsx:39-56`
**Finding**: For each daily log, an individual fetch to `/api/taggings` is made. With 50 logs, this creates 50 HTTP requests. The `Promise.all` provides concurrency but not batching. Additionally, the `useEffect` depends on `[logs]` which changes after the first effect completes, causing a double-render waterfall.
**Prior audit**: Not previously reported.
**Fix**: Batch all log IDs into a single API call: `/api/taggings?taggable_ids=id1,id2,...`. Or use a React Query `useQueries` pattern with proper batching.

### P1-10 · Zero React.memo usage across codebase

**Finding**: `grep -r "memo("` across all `.tsx` files returns zero matches (excluding node_modules). Every component re-renders on every parent render, including heavy components like `PhotoWall`, `ProjectCompare`, `AttendanceInsights`, and `RoleDashboard`.
**Prior audit**: Not previously reported.
**Fix**: Apply `React.memo` to components that receive stable props and render expensive subtrees. Prioritize `PhotoCard`, `CommentItem`, `DefectCard`, and dashboard widgets. Measure with React DevTools Profiler before and after.

---

## P2 — Medium (14)

### P2-1 · Missing `loading.tsx` on 14+ routes

**File**: `web/app/[locale]/` route tree
**Finding**: Only 1 route (`blog/[id]/loading.tsx`) has a loading state. All other routes (projects, defects, checkin, settings, dashboard, admin/*) show nothing during Suspense/resolution. Users see a blank page or spinner from the browser.
**Fix**: Add `loading.tsx` to high-traffic routes: `projects/[id]/`, `defects/[id]/`, `dashboard/`, `checkin/`, `settings/`. Use skeleton UI matching the page layout.

### P2-2 · Missing `error.tsx` on all sub-routes

**File**: `web/app/[locale]/` route tree
**Finding**: No route has an `error.tsx` boundary. Uncaught errors in any route segment will crash the entire layout instead of showing a graceful error state.
**Fix**: Add `error.tsx` to at minimum: `projects/[id]/`, `defects/[id]/`, `admin/`, `settings/`. Use a simple error boundary with retry button.

### P2-3 · `noValidate` missing from most forms

**Files**: `web/components/auth/AuthForm.tsx:53`, `web/components/DailyLogForm.tsx:162`, `web/components/defects/DefectCreateModal.tsx:171`, `web/components/comments/CommentForm.tsx:34`
**Finding**: Forms rely on HTML5 browser validation (red bubbles) which are inconsistent across browsers, not localizable, and poorly styled. Without `noValidate`, the custom validation logic is bypassed on some browsers.
**Fix**: Add `noValidate` to all `<form>` elements and rely entirely on the custom validation logic.

### P2-4 · PhotoUpload has no file-type validation

**File**: `web/components/PhotoUpload.tsx`
**Finding**: The file input accepts all file types. Users can accidentally upload videos, PDFs, or executables. No client-side MIME type check or extension filter exists.
**Fix**: Add `accept="image/*"` to the `<input type="file">`. Add a client-side check in the upload handler to reject non-image files with a clear error message.

### P2-5 · Locale-unaware date formatting (9 instances)

**Files**: `AttendancePanel.tsx:153`, `RoleDashboard.tsx:339`, `DefectCard.tsx:67`, `DefectDetail.tsx:130`, `PhotoMap.tsx:61`, `AuditLogViewer.tsx:85`, `admin/users/page.tsx:171`, `admin/team/page.tsx:181`, `schema/page.tsx:378`
**Finding**: `toLocaleDateString()` / `toLocaleString()` called without a locale argument. These use the browser's default locale instead of the app's selected locale, causing inconsistent date formats across users.
**Fix**: Use `useLocale()` from `next-intl` and pass it: `toLocaleDateString(locale, options)`. Or migrate to `useFormatter().dateTime()` from next-intl.

### P2-6 · Root `<html lang="mk">` hardcoded

**File**: `web/app/layout.tsx:18`
**Finding**: SSR always serves `lang="mk"` regardless of the user's locale. `HtmlLangSync.tsx` compensates client-side but creates a flash where screen readers see the wrong language during SSR hydration.
**Fix**: Generate the `lang` attribute dynamically from the locale parameter in the `[locale]/layout.tsx` parent, or use middleware to set it.

### P2-7 · SVG icons missing `aria-hidden`

**Files**: `web/components/Navbar.tsx:58,75,93,143`, `web/components/defects/DefectAging.tsx:33,39,45`, `web/components/DefectCreateModal.tsx:41`
**Finding**: SVG icons used alongside text labels are not marked `aria-hidden="true"`. Screen readers may announce the SVG's internal text or role redundantly alongside the visible label.
**Fix**: Add `aria-hidden="true"` to all decorative SVGs.

### P2-8 · TimelapseSlideshow auto-plays without pause control

**File**: `web/components/TimelapseSlideshow.tsx:74`
**Finding**: The slideshow auto-plays on mount with `setInterval`. There is a stop button but no pause/resume toggle. Users who want to examine a frame must stop the entire slideshow.
**Fix**: Add a pause/resume toggle button alongside the existing stop button.

### P2-9 · Navbar outer `<nav>` missing label

**File**: `web/components/Navbar.tsx:135`
**Finding**: `<nav className="hidden md:flex items-center space-x-1">` has no `aria-label`. If multiple `<nav>` elements exist on the page (there are two — desktop and mobile), screen readers cannot distinguish them.
**Fix**: Add `aria-label={t('mainNavigation')}` (or "Primary" / "Mobile") to each `<nav>`.

### P2-10 · PhotoLightbox comments close button missing `aria-label`

**File**: `web/components/PhotoLightbox.tsx:242`
**Finding**: The close button for the comments panel has no `aria-label`. Screen readers announce it as "button" with no purpose.
**Fix**: Add `aria-label={t('closeComments')}`.

### P2-11 · DefectBoard / RoleDashboard god-component anti-pattern

**Files**: `web/components/DefectBoard.tsx` (~620 lines), `web/components/RoleDashboard.tsx` (~880 lines)
**Finding**: Both components are monolithic files handling data fetching, state management, drag-and-drop, and rendering. `RoleDashboard` conditionally renders 5-6 different views based on role. This makes testing, maintenance, and code splitting difficult.
**Fix**: Extract sub-components: `DefectBoardView`, `DefectColumn`, `RoleDashboardView`, `RoleGuard`. Use composition to keep each file under 250 lines.

### P2-12 · `next.config.ts` missing image format optimization

**File**: `web/next.config.ts:9-18`
**Finding**: Images configured with `remotePatterns` for Supabase and `sharp` is installed, but no `formats` property is set. The app serves PNG/JPEG without automatic AVIF/WebP conversion, missing 30-50% size reduction.
**Fix**: Add `formats: ['image/avif', 'image/webp']` to the `images` config.

### P2-13 · Missing `priority` on above-the-fold hero image

**File**: `web/app/[locale]/projects/[id]/page.tsx:287-293`
**Finding**: The hero photo on the project detail page (first thing visible) does not have `priority` on the `next/image`. This delays LCP.
**Fix**: Add `priority` to the hero image component.

### P2-14 · Heavy components not code-split

**Files**: `web/components/RoleDashboard.tsx`, `web/components/DefectBoard.tsx`, `web/components/AuditLogViewer.tsx`, `web/components/PhotoCompare.tsx`, `web/components/ReportBuilder.tsx`
**Finding**: These heavy components are statically imported. `RoleDashboard` imports `PhotoWall`, `ProjectCompare`, and `AttendanceInsights` without dynamic imports. All ship in the main bundle.
**Fix**: Use `next/dynamic` with `{ ssr: false }` for components that are below the fold or conditionally rendered.

---

## P3 — Low (13)

### P3-1 · Inconsistent form submission patterns

**Finding**: Forms use 3 different submission approaches: `onSubmit` prop (AuthForm), `onClick` on a button (DailyLogForm), and react-hook-form's `handleSubmit` (DefectCreateModal). This creates inconsistent UX for loading states, error display, and validation timing.
**Fix**: Standardize on react-hook-form + `handleSubmit` for all forms.

### P3-2 · CommentForm hardcoded Macedonian strings

**File**: `web/components/comments/CommentForm.tsx:19-21`
**Finding**: Three hardcoded strings: `'Одговори...'` (Reply...), `'Пишете коментар...'` (Write a comment...), and the button text. Only the `useTranslations` hook call on line 14 is correct — the hardcoded strings bypass it.
**Fix**: Replace with translation keys.

### P3-3 · Label association issues in DefectCreateModal

**File**: `web/components/defects/DefectCreateModal.tsx`
**Finding**: `<label>Desciption *</label>` (also note typo "Desciption") is not associated with the textarea via `htmlFor`/`id`. Same for the severity label. Clicking the label does not focus the input.
**Fix**: Add `htmlFor`/`id` pairs. Fix typo to "Description".

### P3-4 · Label association issue in DailyLogForm

**File**: `web/components/DailyLogForm.tsx:195-207`
**Finding**: `<label>Description *</label>` not associated with the textarea. Clicking label doesn't focus field.
**Fix**: Add `htmlFor="daily-log-description"` and `id="daily-log-description"` to the textarea.

### P3-5 · Heading hierarchy issues

**Files**: `web/app/[locale]/schema/page.tsx:525`, `web/components/defects/DefectDetail.tsx:89`
**Finding**: Schema page jumps from `<h2>` to `<h4>` (skipping `<h3>`). Defect detail has a `<p className="font-bold text-base">` that visually appears as a heading but is not semantic.
**Fix**: Use proper heading hierarchy. The visual heading should be an `<h3>`.

### P3-6 · Missing `aria-expanded` on toggles

**Files**: `web/components/admin/QuickOperations.tsx:88-93`, `web/components/admin/AttentionRequiredSection.tsx:58-59`
**Finding**: Expandable sections use `isOpen` state but the toggle button lacks `aria-expanded` and `aria-controls`. Screen readers cannot determine whether the section is open or closed.
**Fix**: Add `aria-expanded={isOpen}` and `aria-controls="section-id"` to each toggle button.

### P3-7 · MobileFieldNav missing `aria-current="page"`

**File**: `web/components/MobileFieldNav.tsx`
**Finding**: Navigation items don't use `aria-current="page"` on the active link. Screen readers can't distinguish the current page from other nav items.
**Fix**: Add `aria-current={isActive ? 'page' : undefined}` to each nav link.

### P3-8 · PermissionEditor toggle missing `aria-label`

**File**: `web/components/admin/PermissionEditor.tsx`
**Finding**: Toggle switches (Enable/Disable buttons) have no `aria-label`. Screen readers announce "button" without context.
**Fix**: Add `aria-label={t('enablePermission')}` / `aria-label={t('disablePermission')}`.

### P3-9 · Oversized client components (760L, 637L)

**Files**: `web/app/[locale]/admin/labels/page.tsx` (~760 lines), `web/app/[locale]/projects/[id]/schema/page.tsx` (~637 lines)
**Finding**: Both pages are large client components with inline logic. They could be decomposed into smaller client sub-components with a server component wrapper.
**Fix**: Extract form logic, table rendering, and map rendering into separate client components. Keep the page component as a thin orchestrator.

### P3-10 · `@types/leaflet` in `dependencies` instead of `devDependencies`

**File**: `web/package.json:24`
**Finding**: Type-only package included in production dependencies. Increases install size unnecessarily.
**Fix**: Move to `devDependencies`.

### P3-11 · Hardcoded Macedonian alt text

**File**: `web/app/[locale]/projects/[id]/page.tsx:289`
**Finding**: `alt={photos[0].note ?? 'Фотографија'}` — "Photograph" hardcoded in Macedonian.
**Fix**: Use `t('photoAlt')` with the note as fallback.

### P3-12 · Hardcoded metadata title

**File**: `web/app/layout.tsx:7`
**Finding**: `title: "Construction Photo Log"` hardcoded in English. Not localized.
**Fix**: Use next-intl's `generateMetadata` to localize the title.

### P3-13 · WorkOrderCreateForm silently returns on empty title

**File**: `web/components/work-orders/WorkOrderCreateForm.tsx`
**Finding**: `handleSubmit` returns early without feedback if the title is empty after trimming. No error message, no toast, no field error.
**Fix**: Show a validation error via the form's error state.

---

## P4 — Info (4)

### P4-1 · Barrel file in `defects/`

**File**: `web/components/defects/index.ts`
**Finding**: Barrel re-exports can prevent tree-shaking in some bundler configurations. With Next.js 16's app router, this is a minor concern but worth noting.
**Fix**: Import directly from component files rather than the barrel.

### P4-2 · `AriaStatusAnnouncer` default status is silent

**File**: `web/components/AriaStatusAnnouncer.tsx`
**Finding**: When no `status` prop is passed, the component renders but announces nothing. This is correct behavior but could confuse developers who expect it to always announce.
**Fix**: Add a comment explaining the silent default behavior.

### P4-3 · Minor: `jsonLd` object recreated on server render

**File**: `web/app/[locale]/layout.tsx:60-98`
**Finding**: The JSON-LD structured data object is recreated on every server render. This is a server component so there's no client re-render concern, but memoizing it would reduce GC pressure on high-traffic pages.
**Fix**: Move to a constant outside the component or wrap in `useMemo`.

### P4-4 · PhotoLightbox defect severity dots lack text labels

**File**: `web/components/PhotoLightbox.tsx:271-273`
**Finding**: Defect severity is shown as a colored dot without text. Combined with P1-2 (color-only), this is a minor UX observation.
**Fix**: Add a tooltip or `title` attribute with the severity text.

---

## What's Working Well

The following areas were audited and found to be in good shape:

- **Route metadata**: Every route has a `metadata.ts` export with proper titles and descriptions.
- **Layout hierarchy**: Nested layouts correctly inherit from parent layouts (defects, settings, projects).
- **RBAC enforcement**: Server-side Supabase + middleware + ClientProvider `useRole` defense-in-depth.
- **Server/client split**: `useRole`, `useParams`, `useSearchParams`, `useRouter`, `useState`, `useEffect`, `useTranslations` are all correctly in client components.
- **Admin i18n**: All admin components properly use `useTranslations`. The prior audit flag about admin pages not using i18n appears resolved.
- **Date-fns usage**: Many components (ProjectAnalytics, PhotoCard, PhotoWall, PhotoCalendarHeatmap) correctly use date-fns with locale mapping.
- **Locale switcher**: Properly implemented with `aria-label`, disabled during transition, present in both desktop and mobile nav.
- **Next.js config**: `serverExternalPackages: ["pdfkit"]` correct. `sharp` installed. Supabase images configured.
- **`AriaStatusAnnouncer`**: Proper `role="status"` + `aria-live="polite"` pattern.
- **`useEffect` cleanup**: Most hooks properly return abort controller cleanup functions.
- **Zustand stores**: Well-structured with middleware, no unnecessary re-renders.
- **Client-side queries**: Proper Supabase client setup in hooks, though React Query migration recommended.

---

## Fix Priority Roadmap

| Phase | Severity | Items | Effort |
|-------|----------|-------|--------|
| **Phase 1: Security** | P0 | P0-1 (XSS) | 1 hour |
| **Phase 2: i18n completeness** | P0 | P0-2 (CommentItem Macedonian) | 2 hours |
| **Phase 3: Dark mode** | P0 | P0-3, P0-4 (ThemeProvider + persistence) | 4 hours |
| **Phase 4: a11y critical** | P1 | P1-1, P1-2, P1-3 (skip link, color-only, labels) | 3 hours |
| **Phase 5: Data integrity** | P1 | P1-5, P1-6, P1-7, P1-8, P1-9 (error handling, hooks) | 6 hours |
| **Phase 6: Performance** | P1-P2 | P1-10, P2-1, P2-2, P2-12, P2-13, P2-14 (memo, loading, splitting) | 8 hours |
| **Phase 7: Forms** | P1-P2 | P1-4, P2-3, P2-4 (Zod, noValidate, file validation) | 6 hours |
| **Phase 8: i18n consistency** | P2-P3 | P2-5, P2-6, P3-2, P3-11, P3-12 (locale dates, lang attr) | 4 hours |
| **Phase 9: Polish** | P3-P4 | P3-1 through P3-13, P4-1 through P4-4 | 6 hours |

**Total estimated effort**: ~40 hours across 9 phases.

---

*Generated by frontend audit agent, 2026-08-17. All findings are from read-only analysis — no files were modified.*
