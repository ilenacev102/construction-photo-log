# Photo Construction Log — Design System

## 1. Atmosphere & Identity

A warm, confident command center for field operations. Cream-toned surfaces that
feel like a well-kept site office rather than a sterile dashboard — calm,
trustworthy, quietly premium. The signature is **warmth through restraint**:
a cream base (85-hue neutral) with a single amber accent and deep slate
foregrounds. Surfaces separate by subtle tonal shift and hairline borders, not
heavy shadows. Motion is soft and spring-like — nothing snaps, everything
settles.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--background` | `oklch(0.985 0.005 85)` | `oklch(0.13 0.02 260)` | Main background |
| Surface/card | `--card` | `oklch(0.995 0.003 85)` | `oklch(0.17 0.025 260)` | Cards, panels |
| Surface/popover | `--popover` | `oklch(0.995 0.003 85)` | `oklch(0.17 0.025 260)` | Modals, menus |
| Text/primary | `--foreground` | `oklch(0.13 0.02 260)` | `oklch(0.97 0.005 85)` | Headlines, body |
| Text/secondary | `--muted-foreground` | `oklch(0.55 0.015 260)` | `oklch(0.65 0.01 260)` | Captions, hints |
| Text/tertiary | — | `oklch(0.42 0.015 260)` | `oklch(0.5 0.01 260)` | Disabled, muted (alpha-based) |
| Border/default | `--border` | `oklch(0.89 0.008 85)` | `oklch(1 0 0 / 10%)` | Dividers, outlines |
| Accent/primary | `--accent` | `oklch(0.72 0.14 55)` | `oklch(0.72 0.14 55)` | CTAs, links, badges, focus |
| Accent/hover | — | `oklch(0.66 0.14 55)` | `oklch(0.78 0.13 55)` | Accent hover state |
| Primary/button | `--primary` | `oklch(0.21 0.045 260)` | `oklch(0.92 0.02 85)` | Solid buttons |
| Status/success | — | `oklch(0.6 0.15 150)` | `oklch(0.7 0.15 150)` | Confirmations, resolved |
| Status/warning | — | `oklch(0.7 0.15 70)` | `oklch(0.78 0.14 70)` | Cautions, aging |
| Status/error | `--destructive` | `oklch(0.577 0.245 27)` | `oklch(0.704 0.191 22)` | Errors, destructive |

### Rules
- Accent is used ONLY for interactive/decorative emphasis — never body text.
- All grays share one warm family (85 hue). Never mix cool grays in.
- Shadows are tinted to the surface hue (warm), never pure black.
- Never introduce a color not in this table. Extend the table first.

## 3. Typography

### Font Stack
- Primary: `Geist, system-ui, -apple-system, sans-serif` (loaded via next/font)
- Mono: `Geist Mono, ui-monospace, monospace` (data, IDs, timestamps)

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `text-4xl`–`text-6xl` | 600 | 1.1 | `-0.02em` | Hero, page title |
| H1 | `text-3xl` | 600 | 1.2 | `-0.015em` | Page headers |
| H2 | `text-2xl` | 600 | 1.3 | `-0.01em` | Section headers |
| H3 | `text-xl` | 600 | 1.4 | 0 | Card titles |
| Body/lg | `text-lg` | 400 | 1.6 | 0 | Lead paragraphs |
| Body | `text-sm`/`text-base` | 400 | 1.6 | 0 | Default text |
| Caption | `text-xs` | 500 | 1.4 | `0.01em` | Labels, metadata |
| Overline | `text-[11px]` | 600 | 1.3 | `0.08em` | Uppercase section labels, role badges |

### Rules
- Numbers and timestamps use `tabular-nums` (mono digits, no jitter).
- Paragraph width limited to ~65ch for readability.
- Headings: `tracking-tight`, sentence case (never Title Case).
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.

## 4. Spacing & Layout

### Base Unit
All spacing derives from a base of **4px** (Tailwind's `--space-*` scale).

| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Icon-to-label |
| space-2 | 8px | Compact list items |
| space-3 | 12px | Form field padding |
| space-4 | 16px | Standard card inner padding |
| space-6 | 24px | Generous card padding |
| space-8 | 32px | Between card groups |
| space-10–16 | 40–64px | Section rhythm |
| space-20–24 | 80–96px | Page-level breathing room |

### Grid
- Max content width: **80rem (1280px)** via `max-w-5xl`/`max-w-6xl` containers.
- Breakpoints: sm 640, md 768, lg 1024, xl 1280.
- Mobile-first: everything stacks to single column below 768px with `px-4`.

### Rules
- No magic numbers; every value maps to a Tailwind spacing token.
- Full-height sections use `min-h-[100dvh]`, never `h-screen`.

## 5. Components

### Button (ui/button.tsx)
- **Structure**: `<button>` base + cva variants (default/outline/secondary/ghost/destructive/link) × sizes (xs–lg, icon).
- **States**: hover (tint shift), active (`translate-y-px` + `active:scale-[0.98]`), focus-visible (ring), disabled (50% opacity), loading (spinner + disabled).
- **Motion**: `transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]`.
- **Accessibility**: visible focus ring, `aria-invalid` support, no pointer-events on inner svg.

### Card (ui/card.tsx)
- **Structure**: rounded-xl, hairline `border-border`, `bg-card`, soft `shadow-sm`.
- **Depth strategy**: borders + tinted shadow (see Section 7). Cards only where elevation communicates hierarchy.
- **States**: rest / hover (slight lift `hover:-translate-y-0.5` on interactive cards only).

### Navbar
- **Structure**: sticky top, `backdrop-blur-md`, cream glass; brand left, links/actions right.
- **States**: active link gets accent underline indicator (pathname-based); hover tint.
- **Motion**: hamburger morphs to X (rotate/translate, GPU-safe); mobile menu items stagger-fade in.
- **Responsive**: desktop row → mobile hamburger + slide-down panel (sm: breakpoint).

### Badge (role/status pills)
- Rounded-md, `border border-accent/20 bg-accent/10 text-accent`, `text-[11px] uppercase tracking-wider`.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 150–200ms | `ease-out` | Button hover, icon morph |
| Standard | 250–300ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Panel open, tab switch |
| Emphasis | 400–600ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Hero entry, page transitions |
| Stagger | 50ms steps | — | Menu items, grid reveals |

### Rules
- **Only animate `transform` and `opacity`.** Never layout properties.
- Every interactive element has hover + active + focus-visible states.
- Scroll reveals use `IntersectionObserver` (or a `whileInView`-style lib), never `scroll` listeners.
- Respect `prefers-reduced-motion`: disable non-essential animation via media query.
- `backdrop-blur` only on fixed/sticky elements (nav, overlays) — never scrolling content.

## 7. Depth & Surface

### Strategy: **mixed** — hairline borders for structure, tinted shadows for elevation

| Level | Value | Usage |
|-------|-------|-------|
| Hairline | `border border-border` | Cards, dividers at rest |
| Subtle shadow | `shadow-sm shadow-foreground/5` | Cards, dropdowns |
| Elevated | `shadow-md shadow-accent/10` | Hover lift, modals |
| Prominent | `shadow-lg shadow-accent/15` | Popovers, command menus |

### Rules
- Shadows are **warm-tinted** (accent hue), never pure black at high opacity.
- Flat surfaces: use `bg-muted/40` tonal shift instead of borders where lighter.
- No arbitrary `z-50`/`z-[9999]` — reserve: nav (50), overlay (60), modal (70), toast (80).
