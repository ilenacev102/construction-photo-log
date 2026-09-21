# Design: Работни налози (Work Orders)

> Date: 2026-08-10
> Status: Proposed — pending approval
> Feature gap: B9 from `docs/feature-gaps-audit.md`

## 1. Concept

A **работен налог (work order)** is a preventive task assigned by a manager to an
employee, scoped to a project. Unlike a **defect** (a reported problem), a work
order is a directive: *what to do, where, by whom, by when*.

Decisions confirmed with the owner:

- Status flow: `pending → in_progress → done` (+ `cancelled`)
- UI: dedicated `/work-orders` page + "Мои налози" section on worker dashboard
- MVP scope: CRUD + status + priority + due date. **No comments/attachments/notifications** (second iteration)

## 2. Data model — `work_orders` table

New migration: `supabase/migrations/20260810000002_work_orders.sql`

```sql
CREATE TABLE work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','done','cancelled')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_orders_project_id_idx ON work_orders (project_id);
CREATE INDEX work_orders_assigned_to_idx ON work_orders (assigned_to);
CREATE INDEX work_orders_status_idx ON work_orders (status);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
```

**RLS policies** (defense-in-depth; enforcement happens in API routes):

| Policy | Action | Rule |
|---|---|---|
| View | SELECT | `public.user_can_access_project(project_id)` OR `auth.uid() = assigned_to` |
| Manage | INSERT/UPDATE/DELETE | owning company's `site_manager`/`admin` (mirrors `project_members` policy) |
| Status by assignee | UPDATE (status only) | `auth.uid() = assigned_to` AND status moves forward (`pending→in_progress→done`) |

**Types** (`web/types/database.ts`):

```ts
export type WorkOrderStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type WorkOrderPriority = 'low' | 'medium' | 'high'
export interface WorkOrder {
  id: string
  project_id: string
  title: string
  description: string | null
  location: string | null
  assigned_to: string | null
  assigned_by: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  due_date: string | null
  created_at: string
  updated_at: string
}
```

## 3. API — mirrors the `defects` route pattern

Single `web/app/api/work-orders/route.ts` (same shape as `defects/route.ts`):

| Method | Auth | Behavior |
|---|---|---|
| `GET` | authenticated | `?projectId=` scoped list; global list for admin (like defects). Optional filters: `statusFilter`, `assignedTo`. Uses `requireProjectAccess` |
| `POST` | manager (project_mutate) | `requireProjectMutate`. Body: `project_id, title, description?, location?, assigned_to?, priority?, due_date?`. Sets `assigned_by = user.id` |
| `PATCH` | assignee OR manager | Body `{ id, status }`: **assignee** may transition own order forward (pending→in_progress→done). **Manager** may set any status incl. cancelled + reassign/update fields |
| `DELETE` | manager | `requireProjectMutate`, soft policy: only creator/manager |

Roles (from `useRole`): **manager** = `site_manager` | `admin`; **worker** = `photographer` | `foreman`.

## 4. Hook — `web/hooks/useWorkOrders.ts`

Mirrors `useDefects.ts`:

```ts
interface UseWorkOrdersOptions {
  projectId?: string        // undefined → global list (admin/manager dashboard)
  statusFilter?: WorkOrderStatus | 'all'
  assignedTo?: string       // "me" supported for worker view
}
// returns { workOrders, isLoading, error, createWorkOrder, updateStatus, updateWorkOrder, deleteWorkOrder }
```

## 5. UI

### 5.1 New page — `/work-orders` (`web/app/[locale]/work-orders/page.tsx`)

- Accessible to all authenticated users; role-aware.
- **Manager view**: filter bar (project, status, assignee), table/cards of all
  work orders, **create form** (title, description, location, assignee dropdown
  from company members, priority, due date), inline status transitions,
  edit + cancel + delete.
- **Worker view**: only their own orders (server-filtered), status buttons
  (Започни → Заврши), read-only detail otherwise.
- Route registered in `web/i18n/navigation.ts` + Navbar link (manager+).

### 5.2 Worker dashboard — "Мои налози" section (`dashboard/worker/page.tsx`)

- New section listing orders where `assigned_to = me` and status ≠ done/cancelled.
- Compact list: title, project, due date (overdue highlighted), status buttons.
- Stat card "Отворени налози" added to the stats grid.

### 5.3 Manager dashboard — quick link + section (`dashboard/manager/page.tsx`)

- "Работни налози" quick-action link → `/work-orders`.
- (Optional) open work orders count in stats grid.

## 6. i18n

New `workOrders` namespace in all 5 locales:
`web/messages/{en,mk,de,sr,sl}.json` — keys: title, subtitle, create, edit,
titleLabel, descriptionLabel, locationLabel, assigneeLabel, priorityLabel,
dueDateLabel, statusLabel, status.pending/in_progress/done/cancelled,
priority.low/medium/high, myWorkOrders, start, finish, cancel, overdue,
noWorkOrders, createSuccess/error, updateSuccess/error.

## 7. Out of scope (second iteration)

- Comments on work orders, attachments/photos
- Email/in-app notifications on assignment or status change
- QR/check-in integration
- Recurring work orders / templates

## 8. Verification

- `npx tsc --noEmit` clean in `web/`
- `supabase db push` applies migration; RLS policies verified with SQL probes
  (assignee can PATCH own status; worker cannot create; client cannot manage)
- Manual: manager creates + assigns → worker sees in "Мои налози" → worker
  starts/finishes → manager sees updated status on `/work-orders`
