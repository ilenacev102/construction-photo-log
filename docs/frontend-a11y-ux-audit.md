# Frontend UX & Accessibility Audit — Construction Photo Log

**Audit scope:** `/web` (Next.js 16.2.11, React 19, Tailwind CSS 4, next-intl; locales `de, en, mk, sl, sr`, default `mk`, `localePrefix: 'as-needed'`)
**Method:** Read-only source analysis. Every finding verified against current source with file:line evidence. No prior audit reports were trusted; all claims re-derived from code.
**Date:** 2026-07-31

---

## 1. Executive Summary

The application has a **solid foundation** — real semantic `<table>`/`<th>` markup, translated message catalogs that are identical across all 5 locales, a button primitive with proper focus-visible rings and dark variants, locale-aware date rendering in the timeline, a fully-keyboard-navigable photo lightbox, and a recent commit (`b5753c5`) that already improved mobile touch targets and dashboard stacking.

However, the app is **NOT release-ready**. Three P0 problem classes block certification:

1. **No focus management in any of the 5 custom modals.** Zero `role="dialog"`/`aria-modal`, zero `tabIndex`, zero `.focus()` calls, and Escape handling exists in exactly one modal (PhotoLightbox). Keyboard users tab straight out of open dialogs into background content → WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7 violations on core flows (photo viewing, defect board, permission editor).
2. **Pervasive hardcoded strings** in a 5-locale product — dozens of English/Macedonian literals in access-denied screens, the entire Daily Log form, team management, admin labels, lightbox controls, photo cards, and error messages.
3. **Dead dashboard CTAs.** Every quick-action button on the worker dashboard (`addPhoto`, `reportDefect`, `dailyLog`) navigates to `/dashboard`; three of four manager quick links do the same; the Navbar links Dashboard and Projects to the same `/dashboard` URL.

Additionally: **no `aria-live`/`role="status"` anywhere** (every async load is silent), no PWA manifest, no JSON-LD, no canonical/hreflang, no `prefers-reduced-motion`, and no skeletons.

---

## 2. Findings Table

| # | Severity | Finding | Location | WCAG |
|---|----------|---------|----------|------|
| F1 | **P0** | Modals lack `role="dialog"`/`aria-modal`, focus trap, and focus management | PhotoLightbox, DefectBoard, PermissionEditor, schema page, labels page (all 5 modals) | 1.3.1, 2.1.1, 2.1.2, 2.4.3, 2.4.7 |
| F2 | **P0** | Escape handling missing in 4 of 5 modals | DefectBoard, PermissionEditor, schema, labels | 2.1.1 |
| F3 | **P0** | Hardcoded English/Macedonian strings throughout (i18n) | ~30 file:line sites (see §3.2) | 3.1.1 |
| F4 | **P0** | Dead dashboard CTAs (all navigate to `/dashboard`) | worker L139–147, manager L139–150, Navbar L32–35 | — (functional) |
| F5 | **P0** | No `aria-live`/`role="status"` — async loading/errors silent | every async page (dashboards, board, upload, attendance) | 4.1.3 |
| F6 | **P1** | No PWA manifest, no app icons (default Next.js SVGs only) | `public/` | — |
| F7 | **P1** | No structured data (JSON-LD) | root layout | — |
| F8 | **P1** | No canonical / hreflang (multi-locale SEO) | root layout | — |
| F9 | **P1** | No `prefers-reduced-motion`; spinners + hover zoom always animate | PhotoCard, spinners everywhere | 2.3.3 |
| F10 | **P1** | Drawing tools pointer-only; emoji-as-label buttons unlocalized | DrawingCanvas `TOOLS` | 2.1.1, 1.3.1 |
| F11 | **P1** | Photo dates use hardcoded `mk` locale + "ГПС:" label + MK alt | PhotoCard L16–17, L30, L48 | 3.1.1 |
| F12 | **P1** | Supabase `error.message` shown verbatim (EN, unlocalized) | AuthForm | 3.3.1 |
| F13 | **P1** | Audit-log action/entity strings displayed raw (EN transform) | AuditLogViewer; manager L230–232 | 3.1.1 |
| F14 | **P1** | Manager dashboard shows raw `user_id` prefixes | manager L188 | — (privacy/UX) |
| F15 | **P1** | `toLocaleString()`/`toLocaleTimeString()`/`toLocaleDateString()` — browser-locale dependent | manager L191/228, team page L186 | 3.1.1 |
| F16 | **P1** | Empty-state inline SVG not `aria-hidden` | PhotoTimeline L42–54 | 1.3.1 |
| F17 | **P1** | No keyboard alternative for drag-and-drop defect board | DefectBoard | 2.1.1 |

---

## 3. Detailed Findings

### 3.1 Modal accessibility (F1, F2) — P0

The app renders **five** full-screen overlay modals (all use `fixed inset-0 z-50`):

| Modal | Escape | role="dialog" | Focus trap | Focus return |
|-------|--------|---------------|------------|--------------|
| `PhotoLightbox.tsx` | ✅ L65/L78 (arrows + Escape) | ❌ | ❌ | ❌ |
| `DefectBoard.tsx` (AddDefectModal) | ❌ | ❌ | ❌ | ❌ |
| `PermissionEditor.tsx` | ❌ | ❌ | ❌ | ❌ |
| `projects/[id]/schema/page.tsx` | ❌ | ❌ | ❌ | ❌ |
| `admin/labels/page.tsx` | ❌ | ❌ | ❌ | ❌ |

Grep evidence: `role="dialog"`/`aria-modal` → **0 matches** app-wide; `tabIndex`/`tabindex` → **0 matches**; `.focus()` → **0 matches**; `addEventListener('keydown')` → 1 match (PhotoLightbox).

**Impact:** when any modal opens, focus stays on the trigger button while the modal visually takes over the page; keyboard users tab into hidden background content; screen readers are never told a dialog opened (`1.3.1`). This affects the photo lightbox (primary viewing flow), the defect board (primary field tool), and admin permission/label editing.

**Positive:** PhotoLightbox has full arrow-key navigation, scroll lock (`document.body.style.overflow` L84/86), and a two-step delete confirmation — the interaction model is right, it just lacks the focus contract.

### 3.2 Hardcoded strings (F3) — P0

The message catalogs are complete (see §5), so **every literal below is a genuine localization defect**:

- **Access-denied screens (English):** `dashboard/worker/page.tsx` L75–84, `dashboard/manager/page.tsx` L81–90, `admin/layout.tsx` L36–45, `admin/team/page.tsx` L101–109
- **Entire form without i18n:** `components/DailyLogForm.tsx` — no `useTranslations` import at all (weather, temperature, work description, notes labels all hardcoded)
- **Lightbox controls:** `PhotoLightbox.tsx` L213 "Previous", L228 "Next", L265 "Delete", L282 "Close info" (aria-labels)
- **Admin team:** `admin/team/page.tsx` L118 "Team Management" (h1), L146 "No users found.", L179 `'Manager'` label, L212 "Permissions", L216 "Saving..."
- **Admin labels:** `admin/labels/page.tsx` L23 "Network error", L43–46 `SELECTION_MODES` "Single"/"Multi", L668–671 "Name"/"Slug"/"Color"/"Sort Order", L745–748 placeholders "e.g. Priority"/"e.g. High"
- **Navigation/back:** `admin/layout.tsx` L54 + `pricing/page.tsx` L162 BackButton "Back to Dashboard"/"Back to Home"; `admin/layout.tsx` L59 + `projects/[id]/layout.tsx` L95 nav aria-labels; `Navbar.tsx` L29–30 role label "Manager"/"Admin"
- **Photo content:** `PhotoCard.tsx` L16–17 `date-fns/locale/mk` hardcoded, L30 alt "Фотографија", L48 "ГПС:" label
- **Reports:** `ReportBuilder.tsx` L58 default title "Градежен фото извештај" (Macedonian) regardless of active locale
- **Attendance:** `AttendancePanel.tsx` `formatDuration` → `"--"` / `"{h}h {m}m"`
- **Audit viewer:** `AuditLogViewer.tsx` action strings shown via English-capitalization transform
- **Errors:** `AuthForm.tsx` renders Supabase `error.message` verbatim (English)

### 3.3 Dead navigation CTAs (F4) — P0 (functional)

- `dashboard/worker/page.tsx` L139–147: all three quick-action buttons (`addPhoto`, `reportDefect`, `dailyLog`) call `router.push('/dashboard')` — none reach their labeled destination.
- `dashboard/manager/page.tsx` L139–150: `viewAllProjects`, `defectBoard`, `attendanceReport` all `href="/dashboard"`; only `teamManagement` is correct.
- `Navbar.tsx` L32–35: "Dashboard" and "Projects" nav links share the same `href: '/dashboard'` — the Projects item is unreachable from the navbar.

### 3.4 Silent async feedback (F5) — P0

No `aria-live`, `role="status"`, or `role="alert"` exists anywhere. Loading states are decorative spinners (`animate-spin` divs); every async fetch (dashboards, defect board, photo upload, attendance check-in, permission save) completes with no screen-reader announcement. Violates `4.1.3 Status Messages` (AA).

### 3.5 Platform & SEO gaps (F6–F9, F16) — P1

- `public/` contains only the five default Next.js SVGs (file/globe/next/vercel/window) — no `manifest.json`, no favicon/app icons (L11 confirmed).
- No `application/ld+json` structured data.
- No `rel="canonical"` or `hreflang` tags — notable for a 5-locale site.
- No `prefers-reduced-motion` / `motion-reduce` usage; `PhotoCard` has an infinite-on-hover scale animation and every loader spins forever.
- `PhotoTimeline.tsx` L42–54: empty-state inline SVG lacks `aria-hidden` (decorative).

### 3.6 Input & data handling (F12–F15) — P1

- Raw Supabase error messages surface to users unlocalized (AuthForm).
- Audit actions/entities (`created`, `check_in`, `photo`, …) are database strings rendered as-is with an English capitalization transform.
- Timestamps use browser-locale `toLocaleString()` variants — display language can disagree with the app locale.
- Manager dashboard shows truncated raw `user_id` UUIDs (`"a1b2c3d4..."`) to identify team members — unusable and a minor privacy smell.

### 3.7 Positives (verified, to preserve)

- `components/ui/button.tsx`: base-ui primitive + cva with `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`, full `dark:` variant coverage, `aria-invalid` styling.
- `PhotoLightbox.tsx`: arrow-key + Escape navigation, scroll lock, two-step destructive delete.
- `PhotoTimeline.tsx`: locale-aware `Intl.DateTimeFormat(locale, …)`.
- All dashboards use `useTranslations` for primary content; correct `h1`→`h2` hierarchy; native `<table>`/`<thead>`/`<th>` semantics.
- `globals.css` contains the complete dark-theme token set (`@custom-variant dark`, shadcn tokens in `@theme inline`) — only the toggle is missing.
- Recent commit `b5753c5` delivered: stacked dashboard headers, larger touch targets, mobile-visible PhotoCard delete, larger Navbar hamburger — consistent with the source.

---

## 4. Per-Screen Scorecard

| Screen | i18n | Keyboard | Modals | Semantics | Verdict |
|--------|------|----------|--------|-----------|---------|
| Dashboard (worker) | ⚠ access-denied EN | ✅ | — | ✅ h1/h2, spinner no status | Needs F3–F5 fixes |
| Dashboard (manager) | ⚠ access-denied + table headers EN | ✅ | — | ✅ tables; raw user_id | Needs F3–F5, F14 |
| PhotoLightbox | ⚠ aria-labels EN | ✅ arrows+Esc | ❌ no dialog/trap | ✅ | Needs F1 |
| DefectBoard | ✅ columns t()'d | ❌ DnD pointer-only | ❌ no dialog/Esc/trap | ✅ table | Needs F1, F17 |
| DrawingCanvas | ⚠ emoji tools | ❌ pointer-only | — | ⚠ emoji buttons | Needs F10 |
| PhotoUpload | ⚠ partial | ⚠ not re-verified | — | ⚠ | Needs re-check |
| PhotoTimeline | ✅ locale-aware | ✅ | ✅ (via lightbox) | ⚠ svg aria-hidden | Minor (F16) |
| AttendancePanel | ⚠ duration format | ⚠ partial | ⚠ QR modal unverified | ⚠ | Needs re-check |
| DailyLogForm | ❌ zero i18n | ⚠ partial | — | ⚠ | Needs F3 rewrite |
| PermissionEditor | ⚠ Close EN | ✅ | ❌ no dialog/trap | ⚠ | Needs F1, F3 |
| AuditLogViewer | ⚠ raw actions | ⚠ partial | — | ✅ table | Needs F13 |
| ReportBuilder | ⚠ MK default title | ⚠ partial | — | ⚠ | Needs F3 |
| Admin labels | ⚠ EN labels/placeholders | ⚠ | ❌ no dialog/trap | ⚠ | Needs F1, F3 |
| Admin team | ❌ EN h1/labels/perms | ⚠ | ⚠ | ✅ table | Needs F3, F15 |
| Schema page | ⚠ unlabeled closes | ⚠ | ❌ no dialog/trap | ⚠ | Needs F1 |

Legend: ✅ verified good · ⚠ partial/needs deeper re-check · ❌ verified defect · — not applicable

---

## 5. i18n Key Diff

Message catalogs: `web/messages/{mk,en,de,sl,sr}.json`.

| Comparison | Top-level keys | Flat keys | Missing vs `mk` | Extra vs `mk` | Values identical to `mk` |
|------------|----------------|-----------|-----------------|---------------|--------------------------|
| `mk` (reference) | 36 | 562 | — | — | — |
| `en` | 36 | 562 | 0 | 0 | 18 / 562 (3%) |
| `de` | 36 | 562 | 0 | 0 | 77 / 562 (13%) |
| `sl` | 36 | 562 | 0 | 0 | 77 / 562 (13%) |
| `sr` | 36 | 562 | 0 | 0 | 77 / 562 (13%) |

**Conclusion:** the catalogs are complete — no missing or extra keys in any locale. The identical-value subset (3–13%) consists of placeholder-style strings (e.g. `{name}` interpolation fragments), not prose. **The i18n defect is entirely hardcoded literals (§3.2), not the catalogs.** Suggested follow-up: add a lint rule banning English literals in JSX / require `useTranslations` per client component.

---

## 6. Prior-Claim Verification

Verified against source (not trusted from prior audit files):

| Claim | Verdict | Evidence |
|-------|---------|----------|
| H16 hardcoded strings | ✅ **CONFIRMED** | §3.2 (~30 sites) |
| H17/H18 table semantics | ✅ **GOOD** — native `<table>/<th>` everywhere | dashboards, team, audit, board |
| H20 focus trap missing | ✅ **CONFIRMED** — no trap; only PhotoLightbox has Escape | §3.1 |
| H21 drag-drop not keyboard-operable | ✅ **CONFIRMED** | DefectBoard pointer-only |
| H24 multi-photo upload | ❌ **FALSE** — single-file `files?.[0]` | PhotoUpload L30 |
| L8 inline SVG | ✅ **CONFIRMED** | PhotoTimeline empty state |
| L11 PWA (manifest/icons) | ✅ **CONFIRMED MISSING** | `public/` = 5 default SVGs |
| M16 dark-mode toggle | ✅ **CONFIRMED MISSING** (tokens fully present) | globals.css |
| M17 lightbox scroll restore | ✅ **IMPLEMENTED** | PhotoLightbox L84/86 |
| M19 focus-visible | ⚠ **PARTIAL** — buttons ✅; custom controls rely on default rings | ui/button.tsx |
| M26 aria-live/status | ✅ **CONFIRMED MISSING** | 0 matches |
| M27 JSON-LD | ✅ **CONFIRMED MISSING** | 0 matches |
| M28 canonical/hreflang | ✅ **CONFIRMED MISSING** | 0 matches |
| M32 skeletons | ✅ **CONFIRMED MISSING** (spinners only) | 0 `animate-pulse` |
| H17/H19/H22/H23/H25/H29/H30/H31, M18/M20–M25/M29–M31, L9/L10/L12/L13 | ⚠ **Not re-verified** this pass | — |

---

## 7. WCAG 2.1 AA Blocker List

| Criterion | Level | Violation | Finding |
|-----------|-------|-----------|---------|
| 1.3.1 Info & Relationships | A | Dialogs lack `role="dialog"`; emoji-only tool buttons; decorative SVG not `aria-hidden` | F1, F10, F16 |
| 2.1.1 Keyboard | A | No focus trap → background reachable; canvas drawing pointer-only | F1, F10, F17 |
| 2.1.2 No Keyboard Trap | A | Tab exits open modals | F1 |
| 2.4.3 Focus Order | A | Focus never moves into dialogs; no return on close | F1 |
| 2.4.7 Focus Visible | AA | No focus indicator inside modals | F1 |
| 3.1.1 Language of Page/Content | A | English/Macedonian literals in 5-locale app | F3, F11–F13, F15 |
| 3.3.1 Error Identification | A | Unlocalized Supabase error text | F12 |
| 4.1.3 Status Messages | AA | No live regions for async loading/errors | F5 |

Non-blocking enhancement: 2.3.3 Animation from Interaction (no `prefers-reduced-motion`) — F9.

---

## 8. Verdict: P0 / P1 Classification

**Overall: NOT RELEASE-READY (P0 blockers present).**

### P0 — must fix before release
1. **Focus contract for all 5 modals** (F1/F2): add `role="dialog"` + `aria-modal`, move focus into the dialog on open, trap Tab/Shift+Tab, restore focus to the trigger on close, add Escape to the 4 modals missing it. Smallest viable approach: extract a `ModalShell` component (base-ui already provides the primitive) used by all five.
2. **Localize hardcoded strings** (F3): prioritize DailyLogForm, access-denied screens, admin/team, admin/labels, lightbox aria-labels, PhotoCard dates/alt, ReportBuilder default title. Add the JSX literal lint rule to prevent regressions.
3. **Fix dead CTAs** (F4): point worker actions and manager links at their real routes; deduplicate Navbar links.
4. **Add `aria-live`/`role="status"`** (F5) to async loading regions (a shared `<ScreenReaderStatus>` component).

### P1 — next release
- PWA manifest + app icons (F6); JSON-LD (F7); canonical/hreflang (F8).
- `prefers-reduced-motion` support (F9).
- Keyboard alternative for defect drag-and-drop (F17) and drawing tools (F10).
- Localize audit actions, date formatting (`date-fns` locale per active locale), Supabase errors (F11–F13).
- Replace raw `user_id` display with names (F14); `aria-hidden` decorative SVGs (F16).

### Preserve
Do not regress the verified positives (§3.7): button focus-visible ring, lightbox keyboard navigation, timeline locale-aware dates, semantic tables, complete message catalogs, and the dark-token infrastructure.
