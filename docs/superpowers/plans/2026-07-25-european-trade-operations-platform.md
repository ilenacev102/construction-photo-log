# European Trade Operations Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the construction photo log into a full European Trade Operations Platform with trade-specific templates, QR attendance, role-based dashboards, drawing annotations, audit trail, defects/punch lists, AI features, and tiered pricing.

**Architecture:** Monorepo with Next.js 16 (App Router) frontend, Supabase PostgreSQL + Storage backend, Python ReportLab PDF generation. All routes are locale-prefixed (`/[locale]/...`). Each trade is a database-driven template type, not hardcoded pages. Role-based access via database-level RLS policies triggered by user profile roles.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + Storage + Auth), next-intl (de/en/mk/sl/sr), Tailwind CSS + shadcn/ui, Leaflet (maps), ReportLab (PDF), QR Code generation (qrcode library), Exifr (EXIF extraction)

## Global Constraints

- All UI must support 5 languages (de/en/mk/sl/sr) via next-intl
- All database access must go through RLS policies (no BYPASSRLS)
- TypeScript strict mode everywhere
- All new database tables must have `created_at` and `updated_at` timestamps
- Supabase Storage bucket `construction-photos` must stay public-read, authenticated-write
- Photo upload must extract EXIF (date + GPS) via exifr
- All dates use `Intl.DateTimeFormat` per locale (not date-fns)
- Build must pass with `npm run build` (TypeScript + Next.js compilation)
- Every SQL migration must be idempotent (use `IF NOT EXISTS` / `OR REPLACE`)
- All monetary values stored as integer cents in database

---
## File Structure

### New/Modified Files Map

```
web/
├── app/
│   ├── [locale]/
│   │   ├── projects/
│   │   │   ├── [id]/
│   │   │   │   ├── attendance/          ← QR check-in/out UI
│   │   │   │   ├── defects/             ← Punch list / defects
│   │   │   │   ├── pins/                ← Drawing annotations
│   │   │   │   └── settings/            ← Project trade type, team
│   │   │   └── new/page.tsx             ← Enhanced with trade selector
│   │   ├── admin/                       ← Admin dashboard
│   │   │   ├── users/
│   │   │   ├── audit-log/
│   │   │   └── subscriptions/
│   │   └── settings/                    ← User profile (role, company)
│   ├── api/
│   │   ├── attendance/                  ← QR check-in api
│   │   ├── audit/                       ← Audit log query api
│   │   ├── defects/                     ← Defect CRUD api
│   │   ├── pins/                        ← Drawing pin CRUD api
│   │   ├── subscriptions/              ← Stripe webhook + portal
│   │   └── team/                        ← Invite members api
│   └── qr/                             ← QR code generation edge function
├── components/
│   ├── AttendanceDashboard.tsx
│   ├── AudioNote.tsx
│   ├── AuditLogViewer.tsx
│   ├── DefectBoard.tsx
│   ├── DefectCard.tsx
│   ├── DrawingCanvas.tsx
│   ├── PinLayer.tsx
│   ├── ProjectSettings.tsx
│   ├── QRBadge.tsx
│   ├── QRCheckIn.tsx
│   ├── RoleDashboard.tsx
│   ├── SubscriptionManager.tsx
│   ├── TeamInvite.tsx
│   ├── TemplateFieldRenderer.tsx
│   └── TradeSelector.tsx
├── lib/
│   ├── subscriptions/                   ← Stripe helpers
│   │   ├── stripe.ts
│   │   ├── pricing.ts
│   │   └── webhooks.ts
│   └── audit.ts                         ← Audit logging helper
├── hooks/
│   ├── useAuditLog.ts
│   ├── useDefects.ts
│   ├── usePins.ts
│   ├── useQRCheckIn.ts
│   ├── useRole.ts
│   └── useSubscription.ts
├── types/
│   ├── database.ts                      ← Extended with all new tables
│   ├── roles.ts
│   ├── trades.ts
│   ├── defects.ts
│   ├── pins.ts
│   ├── attendance.ts
│   └── subscriptions.ts
└── messages/                            ← Extended with new keys
    ├── de.json
    ├── en.json
    ├── mk.json
    ├── sl.json
    └── sr.json

supabase/
├── migrations/
│   ├── 20260725000004_create_user_profiles.sql
│   ├── 20260725000005_create_trade_templates.sql
│   ├── 20260725000006_create_attendance.sql
│   ├── 20260725000007_create_defects.sql
│   ├── 20260725000008_create_pins.sql
│   ├── 20260725000009_create_audit_log.sql
│   ├── 20260725000010_create_subscriptions.sql
│   └── 20260725000011_create_indexes.sql
└── seed.sql

packages/
└── qr-attendance/                       ← QR generation service (Python)
    ├── src/qr_attendance/
    │   ├── __init__.py
    │   ├── generator.py
    │   └── cli.py
    ├── tests/
    │   └── test_generator.py
    ├── pyproject.toml
    └── README.md
```

---
## Task Decomposition

### Task 0: User Profiles + Role-Based Access Control

**Files:**
- Create: `supabase/migrations/20260725000004_create_user_profiles.sql`
- Create: `web/types/roles.ts`
- Create: `web/hooks/useRole.ts`
- Create: `web/app/api/user/profile/route.ts`
- Modify: `web/lib/supabase/queries.ts`
- Modify: `web/components/Navbar.tsx`
- Modify: `web/messages/*.json` (add role keys)

**Interfaces:**
- Consumes: existing `auth.users` table
- Produces: `profiles` table, `useRole()` hook returning `{ role, companyName, permissions }`
- Produces: `getUserProfile(userId) -> Profile` query function

- [ ] **Step 1: Create profiles SQL migration**

```sql
-- supabase/migrations/20260725000004_create_user_profiles.sql
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'photographer'
    CHECK (role IN ('photographer', 'foreman', 'site_manager', 'client', 'admin')),
  company_name text DEFAULT '',
  full_name text DEFAULT '',
  avatar_url text DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own profile
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', ''));
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Create roles types**

```typescript
// web/types/roles.ts
export type UserRole = 'photographer' | 'foreman' | 'site_manager' | 'client' | 'admin';

export interface Profile {
  id: string
  role: UserRole
  companyName: string
  fullName: string
  avatarUrl: string
  phone: string
  createdAt: string
  updatedAt: string
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  photographer: 10,
  foreman: 30,
  site_manager: 50,
  client: 70,
  admin: 100,
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  photographer: ['photos:create', 'photos:read', 'attendance:checkin'],
  foreman: ['photos:create', 'photos:read', 'photos:delete',
            'defects:create', 'defects:read', 'defects:update',
            'attendance:view', 'team:view'],
  site_manager: ['photos:*', 'defects:*', 'attendance:*', 'team:manage',
                  'report:generate', 'pins:create', 'pins:delete'],
  client: ['photos:read', 'defects:read', 'report:download'],
  admin: ['*'],
}
```

- [ ] **Step 3: Create useRole hook**

```typescript
// web/hooks/useRole.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types/roles'

export function useRole() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setProfile({
            id: data.id,
            role: data.role as UserRole,
            companyName: data.company_name,
            fullName: data.full_name,
            avatarUrl: data.avatar_url,
            phone: data.phone,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          })
          setLoading(false)
        })
    })
  }, [])

  return { profile, loading, role: profile?.role ?? null }
}
```

- [ ] **Step 4: Create profile API route**
- [ ] **Step 5: Update Navbar to show role-based navigation**
- [ ] **Step 6: Add i18n keys for roles**
- [ ] **Step 7: Run migration**
- [ ] **Step 8: Build and verify**

---
### Task 1: Trade Templates & Schemas

**Files:**
- Create: `supabase/migrations/20260725000005_create_trade_templates.sql`
- Create: `web/types/trades.ts`
- Create: `web/components/TradeSelector.tsx`
- Create: `web/components/TemplateFieldRenderer.tsx`
- Create: `web/hooks/useTrades.ts`
- Modify: `web/app/[locale]/projects/new/page.tsx` (add trade selector)
- Modify: `web/app/[locale]/projects/[id]/upload/page.tsx` (add trade-specific fields)
- Modify: `web/messages/*.json` (add trade keys)

**Interfaces:**
- Consumes: existing `projects` table
- Produces: `trade_templates` table, `TradeSelector` component, `TemplateFieldRenderer` component
- Produces: `getTradeTemplates() -> TradeTemplate[]` query

- [ ] **Step 1: Create trade templates SQL migration**

```sql
-- Trade types enum
CREATE TYPE trade_type AS ENUM (
  'general', 'electrical', 'plumbing', 'hvac', 'concrete', 'roofing',
  'framing', 'drywall', 'flooring', 'painting', 'masonry', 'landscaping'
);

-- Trade templates table
CREATE TABLE trade_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade trade_type NOT NULL UNIQUE,
  label jsonb NOT NULL DEFAULT '{}',  -- { "en": "Electrical", "mk": "Електрика", ... }
  fields jsonb NOT NULL DEFAULT '[]', -- Array of field definitions
  icon text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trade_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade templates public read"
  ON trade_templates FOR SELECT
  USING (true);

-- Insert base trade templates
INSERT INTO trade_templates (trade, label, fields, sort_order) VALUES
  ('general', '{"en":"General Construction","de":"Allgemeiner Bau","mk":"Општа градба","sl":"Splošna gradnja","sr":"Opšta gradnja"}',
   '[{"key":"workType","type":"select","label":{"en":"Work Type","mk":"Тип на работа"},"required":true,"options":{"en":["New Construction","Renovation","Demolition","Inspection"],"mk":["Нов објект","Реновација","Демолиција","Инспекција"]}},{"key":"description","type":"textarea","label":{"en":"Description","mk":"Опис"},"required":true},{"key":"materials","type":"text","label":{"en":"Materials Used","mk":"Користени материјали"},"required":false}]', 1),
  ('electrical', '{"en":"Electrical","de":"Elektroinstallation","mk":"Електрика","sl":"Elektrika","sr":"Elektrika"}',
   '[{"key":"circuit","type":"text","label":{"en":"Circuit #","mk":"Коло #"},"required":true},{"key":"voltage","type":"select","label":{"en":"Voltage","mk":"Напон"},"required":true,"options":{"en":["120V","240V","400V","Low Voltage"],"mk":["120V","240V","400V","Низок напон"]}},{"key":"workType","type":"select","label":{"en":"Work Type","mk":"Тип на работа"},"required":true,"options":{"en":["Wiring","Panel Installation","Outlet","Lighting","Grounding","Inspection"],"mk":["Инсталација","Панел монтажа","Приклучок","Осветлување","Земјоврзување","Инспекција"]}},{"key":"permitNumber","type":"text","label":{"en":"Permit #","mk":"Дозвола #"},"required":false}]', 2),
  ('plumbing', '{"en":"Plumbing","de":"Sanitär","mk":"Водовод","sl":"Vodovod","sr":"Vodovod"}',
   '[{"key":"pipeType","type":"select","label":{"en":"Pipe Type","mk":"Тип на цевки"},"required":true,"options":{"en":["Copper","PVC","PEX","Galvanized"],"mk":["Бакар","PVC","PEX","Галванизиран"]}},{"key":"pressureTested","type":"checkbox","label":{"en":"Pressure Tested","mk":"Тестиран под притисок"},"required":false},{"key":"workType","type":"select","label":{"en":"Work Type","mk":"Тип на работа"},"required":true,"options":{"en":["Supply Line","Drain","Fixture Installation","Water Heater","Sewer"],"mk":["Довод","Одвод","Монтажа","Бојлер","Канализација"]}}]', 3),
  ('hvac', '{"en":"HVAC","de":"Heizung/Lüftung","mk":"Греење/Вентилација","sl":"Ogrevanje/prezračevanje","sr":"Grejanje/ventilacija"}',
   '[{"key":"systemType","type":"select","label":{"en":"System Type","mk":"Тип на систем"},"required":true,"options":{"en":["Split Unit","Central AC","Heat Pump","Furnace","Ductwork","Ventilation"],"mk":["Сплит","Централен клима","Топлинска пумпа","Печка","Канали","Вентилација"]}},{"key":"capacity","type":"text","label":{"en":"Capacity (BTU/kW)","mk":"Капацитет (BTU/kW)"},"required":false},{"key":"refrigerantType","type":"text","label":{"en":"Refrigerant Type","mk":"Тип на ладилно средство"},"required":false}]', 4),
  ('concrete', '{"en":"Concrete","de":"Beton","mk":"Бетон","sl":"Beton","sr":"Beton"}',
   '[{"key":"concreteClass","type":"select","label":{"en":"Concrete Class","mk":"Класа на бетон"},"required":true,"options":{"en":["C20/25","C25/30","C30/37","C35/45","C40/50"],"mk":["C20/25","C25/30","C30/37","C35/45","C40/50"]}},{"key":"reinforcement","type":"select","label":{"en":"Reinforcement","mk":"Арматура"},"required":true,"options":{"en":["Rebar #3","Rebar #4","Rebar #5","Mesh","None"],"mk":["Арматура #3","Арматура #4","Арматура #5","Мрежа","Нема"]}},{"key":"volume","type":"text","label":{"en":"Volume (m³)","mk":"Волумен (m³)"},"required":false},{"key":"curingMethod","type":"select","label":{"en":"Curing Method","mk":"Метод на нега"},"required":true,"options":{"en":["Water Curing","Curing Compound","Wet Covering","None"],"mk":["Водена нега","Хемиска","Влажна покривка","Нема"]}}]', 5),
  ('roofing', '{"en":"Roofing","de":"Dachdeckung","mk":"Покрив","sl":"Strešna kritina","sr":"Krov"}',
   '[{"key":"material","type":"select","label":{"en":"Material","mk":"Материјал"},"required":true,"options":{"en":["Clay Tile","Concrete Tile","Metal Sheet","Bitumen","EPDM","Green Roof"],"mk":["Глинени ќерамиди","Бетонски ќерамиди","Метален лим","Битумен","EPDM","Зелен покрив"]}},{"key":"slope","type":"text","label":{"en":"Slope (°)","mk":"Наклон (°)"},"required":false},{"key":"insulationType","type":"select","label":{"en":"Insulation Type","mk":"Тип на изолација"},"required":true,"options":{"en":["Mineral Wool","EPS","PIR","PU Foam","None"],"mk":["Минерална волна","EPS","PIR","PU пена","Нема"]}}]', 6);
```

- [ ] **Step 2: Add `trade` column to projects table**

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trade trade_type NOT NULL DEFAULT 'general';
```

- [ ] **Step 3: Add trade metadata to photos table**

```sql
ALTER TABLE photos ADD COLUMN IF NOT EXISTS trade_metadata jsonb DEFAULT '{}';
```

- [ ] **Step 4: Create types/trades.ts, TradeSelector component, TemplateFieldRenderer**
- [ ] **Step 5: Update project creation form with trade selector**
- [ ] **Step 6: Update photo upload to show trade-specific fields**
- [ ] **Step 7: Add i18n keys for all trades**
- [ ] **Step 8: Run migrations + build**

---
### Task 2: QR Attendance System

**Files:**
- Create: `supabase/migrations/20260725000006_create_attendance.sql`
- Create: `web/types/attendance.ts`
- Create: `web/app/[locale]/projects/[id]/attendance/page.tsx`
- Create: `web/components/QRCheckIn.tsx`
- Create: `web/components/QRBadge.tsx`
- Create: `web/components/AttendanceDashboard.tsx`
- Create: `web/hooks/useQRCheckIn.ts`
- Create: `web/app/api/attendance/checkin/route.ts`
- Create: `web/app/api/attendance/project/[projectId]/route.ts`
- Create: `packages/qr-attendance/src/qr_attendance/generator.py`
- Create: `packages/qr-attendance/pyproject.toml`
- Modify: `web/app/[locale]/projects/[id]/page.tsx` (add attendance link)
- Modify: `web/messages/*.json` (add attendance keys)

- [ ] **Step 1: Create attendance SQL migration**

```sql
CREATE TABLE attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  check_in timestamptz NOT NULL DEFAULT now(),
  check_out timestamptz,
  duration_minutes int GENERATED ALWAYS AS (
    CASE WHEN check_out IS NOT NULL
      THEN EXTRACT(EPOCH FROM (check_out - check_in))::int / 60
      ELSE NULL
    END
  ) STORED,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_project_date ON attendance_logs(project_id, check_in);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attendance"
  ON attendance_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own check-in"
  ON attendance_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own check-out"
  ON attendance_logs FOR UPDATE
  USING (auth.uid() = user_id AND check_out IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Managers/Admins can view all attendance for their projects
CREATE POLICY "Managers view project attendance"
  ON attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('site_manager', 'admin')
    )
  );
```

- [ ] **Step 2: Create QR attendance Python package**
- [ ] **Step 3: Create QR Check-In component (generates QR → scans → checks in)**
- [ ] **Step 4: Create attendance dashboard (who's on site, duration)**
- [ ] **Step 5: Create API routes for check-in/out + query**
- [ ] **Step 6: Add i18n keys for attendance flow**
- [ ] **Step 7: Run migration + build**

---
### Task 3: Drawing Pins & Photo Annotations

**Files:**
- Create: `supabase/migrations/20260725000008_create_pins.sql`
- Create: `web/types/pins.ts`
- Create: `web/components/DrawingCanvas.tsx`
- Create: `web/components/PinLayer.tsx`
- Create: `web/hooks/usePins.ts`
- Create: `web/app/api/pins/[photoId]/route.ts`
- Modify: `web/app/[locale]/projects/[id]/photos/page.tsx` (add pin toggle)
- Modify: `web/components/PhotoCard.tsx` (show pin count, click to annotate)
- Modify: `web/messages/*.json` (add annotation keys)

- [ ] **Step 1: Create pins SQL migration**

```sql
CREATE TABLE drawing_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  pin_type text NOT NULL DEFAULT 'pin'
    CHECK (pin_type IN ('pin', 'arrow', 'rectangle', 'circle', 'freehand', 'text')),
  x float NOT NULL,  -- percentage 0-100
  y float NOT NULL,  -- percentage 0-100
  width float,       -- percentage for shapes
  height float,      -- percentage for shapes
  color text NOT NULL DEFAULT '#ef4444',
  label text DEFAULT '',
  drawing_data jsonb DEFAULT '{}',  -- freehand path data
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drawing_pins_photo ON drawing_pins(photo_id);

ALTER TABLE drawing_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view pins on their photos"
  ON drawing_pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos WHERE id = photo_id AND (
        photos.user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
      )
    )
  );

CREATE POLICY "Users create pins"
  ON drawing_pins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pins"
  ON drawing_pins FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own pins"
  ON drawing_pins FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Create DrawingCanvas component (SVG-based annotation tool)**
- [ ] **Step 3: Create PinLayer (overlays pins on photo)**
- [ ] **Step 4: Create usePins hook + API routes**
- [ ] **Step 5: Integrate into photo detail view**
- [ ] **Step 6: Run migration + build**

---
### Task 4: Audit Trail

**Files:**
- Create: `supabase/migrations/20260725000009_create_audit_log.sql`
- Create: `web/hooks/useAuditLog.ts`
- Create: `web/components/AuditLogViewer.tsx`
- Create: `web/app/[locale]/admin/audit-log/page.tsx`
- Create: `web/app/api/audit/route.ts`
- Create: `web/lib/audit.ts`
- Modify: `web/messages/*.json` (add audit keys)

- [ ] **Step 1: Create audit log SQL migration**

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_project ON audit_logs(project_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);
```

- [ ] **Step 2: Create audit helper**

```typescript
// web/lib/audit.ts
import { createClient } from '@/lib/supabase/server'

export async function logAudit(params: {
  projectId?: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('audit_logs').insert({
    project_id: params.projectId,
    user_id: user.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  })
}
```

- [ ] **Step 3: Create AuditLogViewer component with filters**
- [ ] **Step 4: Create admin audit-log page**
- [ ] **Step 5: Instrument key actions (photo upload, project create, defect status change)**
- [ ] **Step 6: Run migration + build**

---
### Task 5: Defects & Punch Lists

**Files:**
- Create: `supabase/migrations/20260725000007_create_defects.sql`
- Create: `web/types/defects.ts`
- Create: `web/hooks/useDefects.ts`
- Create: `web/components/DefectBoard.tsx`
- Create: `web/components/DefectCard.tsx`
- Create: `web/app/[locale]/projects/[id]/defects/page.tsx`
- Create: `web/app/api/defects/[projectId]/route.ts`
- Modify: `web/app/[locale]/projects/[id]/page.tsx` (add defects tab)
- Modify: `web/messages/*.json` (add defect keys)

- [ ] **Step 1: Create defects SQL migration**

```sql
CREATE TYPE defect_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE defect_status AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'rejected');

CREATE TABLE defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  assigned_to uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text DEFAULT '',
  severity defect_severity NOT NULL DEFAULT 'medium',
  status defect_status NOT NULL DEFAULT 'open',
  location text DEFAULT '',          -- e.g. "Room 201, East wall"
  photo_ids uuid[] DEFAULT '{}',    -- referenced photos
  due_date date,
  resolved_at timestamptz,
  resolution_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_defects_project ON defects(project_id);
CREATE INDEX idx_defects_status ON defects(status);

ALTER TABLE defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site managers can manage all defects"
  ON defects FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
  );

CREATE POLICY "Foremen can create and update defects"
  ON defects FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('foreman', 'site_manager', 'admin'))
  );

CREATE POLICY "Foremen can update assigned defects"
  ON defects FOR UPDATE
  USING (
    auth.uid() = assigned_to OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
  );

CREATE POLICY "Everyone can view defects in their projects"
  ON defects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND (
      projects.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'foreman', 'admin'))
    ))
  );
```

- [ ] **Step 2: Create types, hooks, API routes**
- [ ] **Step 3: Build DefectBoard (kanban-style by status)**
- [ ] **Step 4: Build DefectCard (severity badge, assignee, photo links)**
- [ ] **Step 5: Integrate into project detail page with tab navigation**
- [ ] **Step 6: Run migration + build**

---
### Task 6: Role-Based Dashboards

**Files:**
- Create: `web/components/RoleDashboard.tsx`
- Create: `web/app/[locale]/admin/page.tsx`
- Create: `web/app/[locale]/admin/users/page.tsx`
- Create: `web/app/api/admin/users/route.ts`
- Modify: `web/app/[locale]/dashboard/page.tsx` (role-aware routing)
- Modify: `web/messages/*.json` (add dashboard keys)

- [ ] **Step 1: Build RoleDashboard dispatcher that renders per-role view**
- [ ] **Step 2: Photographer dashboard - "My Shifts", recent uploads, today's check-in**
- [ ] **Step 3: Foreman dashboard - project status, open defects, team on site**
- [ ] **Step 4: Site Manager dashboard - all projects overview, defect summary, attendance report**
- [ ] **Step 5: Client dashboard - project progress, photo gallery, report downloads**
- [ ] **Step 6: Admin dashboard - user management, audit log, subscription overview**
- [ ] **Step 7: Build + verify**

---
### Task 7: Subscription & Pricing

**Files:**
- Create: `supabase/migrations/20260725000010_create_subscriptions.sql`
- Create: `web/types/subscriptions.ts`
- Create: `web/lib/subscriptions/stripe.ts`
- Create: `web/lib/subscriptions/pricing.ts`
- Create: `web/lib/subscriptions/webhooks.ts`
- Create: `web/hooks/useSubscription.ts`
- Create: `web/components/SubscriptionManager.tsx`
- Create: `web/app/api/subscriptions/webhook/route.ts`
- Create: `web/app/api/subscriptions/portal/route.ts`
- Create: `web/app/[locale]/settings/page.tsx`
- Modify: `web/messages/*.json` (add subscription keys)

- [ ] **Step 1: Create subscriptions SQL migration**

```sql
CREATE TYPE plan_tier AS ENUM ('free', 'crew', 'team', 'company');

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  plan plan_tier NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

- [ ] **Step 2: Create pricing model**

```typescript
// web/lib/subscriptions/pricing.ts
export interface PlanFeature {
  photosPerProject: number
  projectsLimit: number
  teamMembers: number
  storageGb: number
  hasQR: boolean
  hasDefects: boolean
  hasAnnotations: boolean
  hasReports: boolean
  hasAI: boolean
  hasAudit: boolean
  hasAPI: boolean
}

export const PLANS: Record<string, { name: string; priceCents: number; features: PlanFeature }> = {
  free: {
    name: 'Free',
    priceCents: 0,
    features: {
      photosPerProject: 50,
      projectsLimit: 3,
      teamMembers: 1,
      storageGb: 1,
      hasQR: false,
      hasDefects: false,
      hasAnnotations: false,
      hasReports: true,
      hasAI: false,
      hasAudit: false,
      hasAPI: false,
    },
  },
  crew: {
    name: 'Crew',
    priceCents: 7900,
    features: {
      photosPerProject: 500,
      projectsLimit: 15,
      teamMembers: 5,
      storageGb: 10,
      hasQR: true,
      hasDefects: true,
      hasAnnotations: false,
      hasReports: true,
      hasAI: false,
      hasAudit: false,
      hasAPI: false,
    },
  },
  team: {
    name: 'Team',
    priceCents: 19900,
    features: {
      photosPerProject: 2000,
      projectsLimit: 50,
      teamMembers: 20,
      storageGb: 50,
      hasQR: true,
      hasDefects: true,
      hasAnnotations: true,
      hasReports: true,
      hasAI: true,
      hasAudit: true,
      hasAPI: true,
    },
  },
  company: {
    name: 'Company',
    priceCents: 49900,
    features: {
      photosPerProject: 10000,
      projectsLimit: -1, // unlimited
      teamMembers: 100,
      storageGb: 500,
      hasQR: true,
      hasDefects: true,
      hasAnnotations: true,
      hasReports: true,
      hasAI: true,
      hasAudit: true,
      hasAPI: true,
    },
  },
}
```

- [ ] **Step 3: Create SubscriptionManager component (plan display, upgrade CTA)**
- [ ] **Step 4: Create Stripe webhook handler**
- [ ] **Step 5: Add subscription checks to gate features**
- [ ] **Step 6: Run migration + build**

---
### Task 8: Dashboard Integration & Navigation Overhaul

**Files:**
- Create: `web/app/[locale]/projects/[id]/layout.tsx` (tab navigation)
- Modify: `web/components/Navbar.tsx` (role-aware nav items)
- Modify: `web/app/[locale]/projects/[id]/page.tsx` (tab-based layout)
- Modify: `web/app/[locale]/dashboard/page.tsx` (role routing)
- Modify: `web/messages/*.json` (add nav keys)

- [ ] **Step 1: Create project layout with tabs**
- [ ] **Step 2: Update Navbar for role-based items**
- [ ] **Step 3: Wire dashboard role routing**
- [ ] **Step 4: Build + verify**

---
### Task 9: Database Indexes & Performance

**Files:**
- Create: `supabase/migrations/20260725000011_create_indexes.sql`

- [ ] **Step 1: Create performance indexes**

```sql
-- Existing tables
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_project_id ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_photos_project_date ON photos(project_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_defects_project_status ON defects(project_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_project_checkin ON attendance_logs(project_id, check_in DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Full-text search index for project names
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);
```

- [ ] **Step 2: Add pg_trgm extension**

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

- [ ] **Step 3: Run migration**

---
### Task 10: i18n Extension — All New Feature Keys

**Files:**
- Modify: `web/messages/mk.json` (add ~150 new keys)
- Modify: `web/messages/en.json`
- Modify: `web/messages/de.json`
- Modify: `web/messages/sl.json`
- Modify: `web/messages/sr.json`

- [ ] **Step 1: Add i18n keys for trades, attendance, defects, pins, audit, dashboards, subscriptions to en.json**
- [ ] **Step 2: Translate to all 5 languages**

---
## Task Dependencies

```
Task 0 (Profiles + RBAC) ──┬──→ Task 6 (Role Dashboards)
                           ├──→ Task 1 (Trade Templates)
                           ├──→ Task 2 (QR Attendance)
                           ├──→ Task 3 (Drawing Pins)
                           ├──→ Task 4 (Audit Trail)
                           ├──→ Task 5 (Defects)
                           ├──→ Task 7 (Subscriptions)
                           └──→ Task 8 (Navigation)

Task 9 (Indexes) ─────────→ Run LAST after all tables exist
Task 10 (i18n) ───────────→ Run AFTER all UI components are built
```

## Parallel Execution Strategy

**Wave 1 (immediate, all parallel):**
- Task 0: Profiles + RBAC foundation
- Task 9: Database indexes (can run alongside as they touch existing tables)

**Wave 2 (after Task 0 completes):**
- Task 1: Trade Templates (depends on projects having trade column)
- Task 2: QR Attendance (depends on profiles)
- Task 3: Drawing Pins (depends on photos + auth)
- Task 4: Audit Trail (independent helper, can be middleware-based)
- Task 5: Defects (depends on profiles for assigned_to)
- Task 7: Subscriptions (depends on profiles)

**Wave 3 (after Wave 2):**
- Task 6: Role Dashboards (depends on all features being present)
- Task 8: Navigation Overhaul (depends on all tabs existing)
- Task 10: i18n Extension (depends on all UI keys being known)
