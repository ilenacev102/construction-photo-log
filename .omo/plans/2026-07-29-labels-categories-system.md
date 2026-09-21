# Labels/Categories System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a company-wide label/category system with typed groups (Trade, Floor, Zone, Status), polymorphic tagging (photos, defects, daily_logs), and API + frontend support.

**Architecture:** New tables (companies, label_groups, labels, taggings) in a Supabase migration, Next.js App Router API routes under `/api/labels/*` and `/api/taggings/*`, and React components for badge/picker/filter/management UIs.

**Tech Stack:** Next.js 14+, Supabase (admin client), TypeScript, PostgreSQL, Tailwind CSS

## Global Constraints

- All new tables use UUID primary keys
- Follow existing API patterns: `requireAuth()` + `getCompanyContext()` + `successResponse()` / `errorResponse()`
- Use `createAdminClient()` for DB access (service_role key)
- All API routes go under `web/app/api/`
- Migration files in `supabase/migrations/` with timestamp naming
- Frontend components use `'use client'` where needed
- Macedonian language UI (matching existing patterns)
- No new npm dependencies
- Company scoping via `company_id` FK (not `company_name` string)

---
### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260730000001_create_labels.sql`

**Summary:** Create `companies`, `label_groups`, `labels`, `taggings` tables with RLS policies, indexes, and seed-data helper.

**Requirements:**
1. `companies` table: `id (uuid PK)`, `name (text unique)`, `created_at`
2. `label_groups` table: `id (uuid PK)`, `company_id (FK→companies)`, `name`, `slug`, `color`, `sort_order`, `selection_mode (check 'single'/'multi')`, `required (boolean)`, `created_at` — unique(company_id, slug)
3. `labels` table: `id (uuid PK)`, `group_id (FK→label_groups)`, `name`, `slug`, `color`, `sort_order`, `created_at` — unique(group_id, slug)
4. `taggings` table: `id (uuid PK)`, `label_id (FK→labels)`, `taggable_type (check 'photo'|'defect'|'daily_log')`, `taggable_id (uuid)`, `created_at` — unique(label_id, taggable_type, taggable_id)
5. Indexes: `label_groups(company_id)`, `labels(group_id)`, `taggings(label_id)`, `taggings(taggable_type, taggable_id)`
6. RLS on all 4 tables with policies:
   - `companies`: SELECT by company scope, INSERT/UPDATE/DELETE by admin
   - `label_groups`: SELECT by company, INSERT/UPDATE/DELETE by manager/admin with company scope check
   - `labels`: SELECT via group's company, INSERT/UPDATE/DELETE by manager/admin
   - `taggings`: INSERT with project access check, SELECT/DELETE same level as tagged entity
7. Create a `seed_default_labels(company_id)` function that inserts 4 default groups (Trade, Floor, Zone, Status) with common labels

---

### Task 2: API Routes — Labels CRUD

**Files:**
- Create: `web/app/api/labels/groups/route.ts`
- Create: `web/app/api/labels/items/route.ts`
- Create: `web/app/api/labels/groups/[id]/route.ts`
- Create: `web/app/api/labels/items/[id]/route.ts`

**Summary:** CRUD for label groups and individual labels, following the existing API patterns (requireAuth, company-auth, successResponse/errorResponse).

**Interfaces:**
- `GET /api/labels/groups` — list all groups for user's company (with nested labels)
- `POST /api/labels/groups` — create group `{ name, slug, color?, sort_order?, selection_mode?, required? }`
- `PATCH /api/labels/groups/[id]` — update group fields
- `DELETE /api/labels/groups/[id]` — delete group (cascade to labels + taggings)
- `GET /api/labels/items?groupId=x` — list labels in a group
- `POST /api/labels/items` — create label `{ group_id, name, slug, color?, sort_order? }`
- `PATCH /api/labels/items/[id]` — update label fields
- `DELETE /api/labels/items/[id]` — delete label (cascade taggings)

All mutations require `site_manager` or `admin` role. Reads require any authenticated user in the same company.

---

### Task 3: API Routes — Taggings + Entity Filters

**Files:**
- Create: `web/app/api/taggings/route.ts`
- Modify: `web/app/api/photos/route.ts`
- Modify: `web/app/api/defects/route.ts`
- Modify: `web/app/api/daily-logs/route.ts`

**Summary:** Add/remove/list taggings, and add `labelSlugs` query parameter to entity list endpoints.

**Interfaces:**
- `POST /api/taggings` — add tag `{ label_id, taggable_type, taggable_id }` (with validation: check `single` mode, check `required` on delete)
- `DELETE /api/taggings` — remove tag `{ label_id, taggable_type, taggable_id }`
- `GET /api/taggings?taggable_type=x&taggable_id=y` — get all labels on an entity
- `GET /api/photos?projectId=x&labelSlugs=a,b,c` — filter photos by label slugs (inner join through taggings + labels)
- Same pattern for `GET /api/defects` and `GET /api/daily-logs`

When `labelSlugs` param is present, filter using a subquery approach: find taggable_ids where label_id is in the set of matching labels.

---

### Task 4: Frontend — Core Components

**Files:**
- Create: `web/hooks/useLabels.ts`
- Create: `web/components/labels/LabelBadge.tsx`
- Create: `web/components/labels/LabelPicker.tsx`
- Create: `web/components/labels/LabelFilterBar.tsx`

**Summary:** Reusable React components for displaying and selecting labels.

**Components:**
1. `LabelBadge`: Displays a single label chip with name + color. Props: `label: { name, color }`, optional `onRemove`, `size: 'sm'|'md'`
2. `LabelPicker`: Multi-select dropdown grouped by label groups. Shows groups as sections, respects `selection_mode` (single=radio, multi=checkbox). Props: `groups: GroupWithLabels[]`, `selected: Label[], onChange: (labels: Label[]) => void`
3. `LabelFilterBar`: Horizontal bar showing groups as expandable filter sections. Props: `groups, activeFilters: Record<string, string[]>, onChange`
4. `useLabels()` hook: Fetches groups+labels from `/api/labels/groups`, returns `{ groups, loading, error, refetch }`

---

### Task 5: Frontend — Admin Page

**Files:**
- Create: `web/app/[locale]/admin/labels/page.tsx`

**Summary:** Admin page for managing label groups and labels. Accessible to `site_manager` and `admin` roles within the admin section.

**Features:**
- List all groups as cards/sections
- Expand group to show its labels
- Add/edit/delete groups (inline form)
- Add/edit/delete labels within a group (inline form)
- Color picker for group and label colors
- Drag-to-reorder (simplified: sort_order number input)

---

### Task 6: Frontend — Integration

**Files:**
- Modify: `web/app/[locale]/projects/[id]/photos/page.tsx`
- Modify: `web/app/[locale]/projects/[id]/defects/page.tsx`
- Modify: `web/app/[locale]/projects/[id]/page.tsx` (daily log)
- Modify: `web/app/[locale]/projects/[id]/upload/page.tsx`

**Summary:** Wire LabelPicker and LabelFilterBar into existing pages.

**Integration points:**
- Photo upload page: add LabelPicker to the upload form, auto-tag photos on upload
- Photo gallery: add LabelFilterBar above photo grid
- Defect list: add LabelFilterBar, show LabelBadge on each defect card
- Daily log: add LabelPicker to daily log form, show badges on log entries
