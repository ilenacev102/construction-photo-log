# Content Localization — Operating Guide

How the site is localized, where strings live, the rules for editing them, and
how to add a locale or a key. The hard rules here exist so that the five locale
files stay structurally identical and reviewable — a broken locale is a broken
site for that language.

## Locale matrix

| Locale | Code | Default locale | Notes |
| --- | --- | --- | --- |
| Macedonian | `mk` | ✅ (default) | Product is authored in Macedonian |
| English | `en` | — | |
| Slovenian | `sl` | — | |
| Serbian | `sr` | — | |
| German | `de` | — | |

Locales, default, and URL prefix strategy are defined once in
`web/i18n/routing.ts`:

```ts
export const routing = defineRouting({
  locales: ['de', 'en', 'mk', 'sl', 'sr'],
  defaultLocale: 'mk',
  localePrefix: 'as-needed',
})
```

Because `localePrefix: 'as-needed'`, the default locale (`mk`) has **no** URL
prefix (`/pricing`), while every other locale does (`/en/pricing`,
`/de/pricing`, …). Redirects and `Link` locale handling come from
`web/i18n/navigation.ts`.

## Where strings live

- **All UI copy** lives in `web/messages/*.json` — one file per locale:
  `de.json`, `en.json`, `mk.json`, `sl.json`, `sr.json`.
- `web/i18n/request.ts` loads `messages/${locale}.json` per request via
  next-intl's `getRequestConfig`; unknown locales fall back to `mk`.
- Each file is a flat-ish JSON object of **namespaces** (`hero`, `features`,
  `pricing`, `blog`, `common`, …), each namespace holding leaf strings and/or
  nested objects (e.g. `pricing.plans.crew.features[]`).
- All five files **must expose the same top-level namespaces and the same key
  paths**. The site renders per-locale; a missing key in one file is a
  `Key not found` fallback in that language (see the parity rule below).

### How components consume messages

Server components: `getTranslations({ locale, namespace })` → `t('key')`.
Client components: `useTranslations(namespace)`. Nested keys use dot paths
(`t('plans.crew.cta')`). `Link`, `redirect`, and middleware all come from
`web/i18n/navigation.ts` (wrapped around next-intl's `createNavigation`).

## Editing rules

### Rule 1 — Keys are never added, renamed, or removed casually

Track 4's mandate was to edit **values only**. A key rename touches five files,
every consumer of that key, and any active feature branch working in the same
namespace. If a string's wording needs to change, change the **value**; only
add/rename/remove keys when the schema itself changes, and update **all five
files in the same commit**.

### Rule 2 — Flatten-parity check (MUST run after every edit)

The locale files are nested JSON but edited via a script that "flattens" the
diff to line-granularity so structural drift shows up as an asymmetry in
`git diff --stat`. To keep the five files in lockstep:

1. Edit **all five** locale files for any value change (copy is translated per
   locale; do not leave one locale behind).
2. Write with `json.dump(indent=2, ensure_ascii=False)` **plus a trailing
   newline** — the exact formatting the files already use. Do not let an editor
   reformat them (e.g. re-indent, reorder keys, strip non-ASCII).
3. Verify each file parses: `python3 -m json.tool web/messages/en.json` (etc.).
4. Verify the diff is **symmetric**: `git diff --stat web/messages` should show
   all 5 files with the same number of changed lines. A locale file missing
   from the diff (or with an odd line count) means it was left out.

A ready-to-reuse script lives at `/tmp/opencode/track4_polish_pricing.py` — it
loads all five files, applies the same value transforms to each, and writes
them back with the canonical formatting. Use it as a template for future
bulk value edits.

### Rule 3 — Keep copy honest and consistent

- No fabricated metrics or fake client names that could be confused with real
  ones (use clearly fictional firm names in marketing/blog copy).
- Pricing copy must match the ground truth in `web/lib/subscriptions/pricing.ts`
  (single source of truth; see `web/docs/pricing.md`). Example: the `team` plan
  has no per-extra-user price, so a localized feature bullet claiming
  `+$5/additional member` was wrong in every locale and was removed.
- When a promised feature does not yet exist (e.g. "Start Free Trial" CTAs —
  the trial is not wired into checkout yet), flag it for the owning track
  rather than re-writing it; the ADR-001 follow-up table tracks this
  (see `web/docs/adr/business-model.md`).

## Adding a new locale (e.g. `it`)

1. Create `web/i18n/routing.ts` entry: add `'it'` to `locales`.
2. Create `web/messages/it.json` — copy any existing file, translate every
   value, keep the exact key structure.
3. Check for per-locale UI text maps in page files (see below) and add an
   `it` entry to each.
4. Add a `languageSwitcher` label entry for the new locale in all existing
   files, and the locale's own self-name in its own file.
5. Run the flatten-parity verification (Rule 2) across all six files.
6. Verify on the dev server: `curl -I http://localhost:3000/it/<route>`
   returns `200`.

## Adding a new key / namespace

1. Add the key to **all five** locale files with translated values.
2. Consume it via `getTranslations`/`useTranslations` with the full dot path.
3. Run Rule 2 verification (json.tool × 5 + symmetric `git diff --stat`).

## UI text that deliberately lives outside the JSON files

When a page needs a string that is specific to one page/feature and the
messages schema is frozen (per Track 4's constraint: "DO NOT edit
`web/messages/*.json` keys"), the established pattern is an **in-page
per-locale map** with a fallback:

```tsx
const CASE_STUDIES_LABEL: Record<string, string> = {
  en: 'Case studies',
  mk: 'Студии на случај',
  sl: 'Študije primerov',
  sr: 'Studije slučaja',
  de: 'Fallstudien',
}

const label = CASE_STUDIES_LABEL[locale] ?? CASE_STUDIES_LABEL.en
```

Examples: the case-studies index page chrome
(`web/app/[locale]/case-studies/page.tsx`, `CONTENT` map) and the blog-index
footer link label (`web/app/[locale]/blog/page.tsx`). The fallback guarantees
a render even if a locale is later added without updating the map — but new
locales should still add entries to these maps (see "Adding a new locale").
When the messages schema is no longer frozen, prefer promoting such strings
into a namespace over keeping in-page maps.

## Content that is not in the JSON files

- **Blog posts & case studies** are markdown files under `web/content/blog/`,
  one file per post, with quoted-YAML frontmatter (`title`, `date`,
  `description`, `type`). They are authored in Macedonian and shared across
  locales (not translated); `web/lib/blog.ts` reads them.
- **Static marketing copy** (hero, pricing comparison scaffolding) may be
  hardcoded in components where a namespace already covers the pattern — check
  the messages file first before hardcoding.

## Verification checklist

After any content-localization change:

1. `python3 -m json.tool web/messages/<loc>.json` for all five locales — parses.
2. `git diff --stat web/messages` — five files, symmetric line counts.
3. `curl -I http://localhost:3000/<locale>/<route>` for each locale — `200`
   (default-locale routes have no prefix; prefixed routes use `/en`, `/sl`, …).
4. Spot-check one page per locale for the edited string (e.g. fetch
   `/en/pricing`, `/sl/pricing`, `/sr/pricing`, `/de/pricing`, `/pricing`).
