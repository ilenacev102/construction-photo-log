-- Create labels/categories system
-- Companies, label_groups, labels, and taggings tables with RLS, indexes, and seed-data helper

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Companies table (tenant root)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (company_name = companies.name OR role = 'admin')
    )
  );

CREATE POLICY "Admins can insert companies"
  ON companies FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update companies"
  ON companies FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete companies"
  ON companies FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Label groups table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS label_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  sort_order integer NOT NULL DEFAULT 0,
  selection_mode text NOT NULL DEFAULT 'single' CHECK (selection_mode IN ('single', 'multi')),
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_label_groups_company ON label_groups(company_id);

ALTER TABLE label_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view label groups for their company"
  ON label_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      JOIN profiles p ON p.company_name = c.name
      WHERE c.id = company_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert label groups"
  ON label_groups FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
    AND EXISTS (
      SELECT 1 FROM companies c
      JOIN profiles p ON p.company_name = c.name
      WHERE c.id = company_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Managers can update label groups"
  ON label_groups FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
    AND EXISTS (
      SELECT 1 FROM companies c
      JOIN profiles p ON p.company_name = c.name
      WHERE c.id = company_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Managers can delete label groups"
  ON label_groups FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
    AND EXISTS (
      SELECT 1 FROM companies c
      JOIN profiles p ON p.company_name = c.name
      WHERE c.id = company_id AND p.id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Labels table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES label_groups(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_labels_group ON labels(group_id);

ALTER TABLE labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labels in their groups"
  ON labels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM label_groups lg
      JOIN companies c ON lg.company_id = c.id
      JOIN profiles p ON p.company_name = c.name
      WHERE lg.id = group_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert labels"
  ON labels FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
    AND EXISTS (
      SELECT 1 FROM label_groups lg
      JOIN companies c ON lg.company_id = c.id
      JOIN profiles p ON p.company_name = c.name
      WHERE lg.id = group_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Managers can update labels"
  ON labels FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
    AND EXISTS (
      SELECT 1 FROM label_groups lg
      JOIN companies c ON lg.company_id = c.id
      JOIN profiles p ON p.company_name = c.name
      WHERE lg.id = group_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Managers can delete labels"
  ON labels FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
    AND EXISTS (
      SELECT 1 FROM label_groups lg
      JOIN companies c ON lg.company_id = c.id
      JOIN profiles p ON p.company_name = c.name
      WHERE lg.id = group_id AND p.id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Taggings table (polymorphic join: label <-> photo | defect | daily_log)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taggings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid REFERENCES labels(id) ON DELETE CASCADE NOT NULL,
  taggable_type text NOT NULL CHECK (taggable_type IN ('photo', 'defect', 'daily_log')),
  taggable_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(label_id, taggable_type, taggable_id)
);

CREATE INDEX IF NOT EXISTS idx_taggings_label ON taggings(label_id);
CREATE INDEX IF NOT EXISTS idx_taggings_entity ON taggings(taggable_type, taggable_id);

ALTER TABLE taggings ENABLE ROW LEVEL SECURITY;

-- Helper function for polymorphic RLS on taggings
-- Resolves project_id from the tagged entity and checks user/project access
CREATE OR REPLACE FUNCTION public.check_taggable_project_access(
  p_taggable_type text,
  p_taggable_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_taggable_type = 'defect' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.defects d
      JOIN public.projects p ON d.project_id = p.id
      WHERE d.id = p_taggable_id
      AND (p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('photographer', 'foreman', 'site_manager', 'admin')
      ))
    );
  ELSIF p_taggable_type = 'photo' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.photos ph
      JOIN public.projects p ON ph.project_id = p.id
      WHERE ph.id = p_taggable_id
      AND (p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('photographer', 'foreman', 'site_manager', 'admin')
      ))
    );
  ELSIF p_taggable_type = 'daily_log' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.daily_logs dl
      JOIN public.projects p ON dl.project_id = p.id
      WHERE dl.id = p_taggable_id
      AND (p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('photographer', 'foreman', 'site_manager', 'admin')
      ))
    );
  ELSE
    RETURN false;
  END IF;
END;
$$;

CREATE POLICY "Taggings visible to users with project access"
  ON taggings FOR SELECT
  USING (check_taggable_project_access(taggable_type, taggable_id));

CREATE POLICY "Foremen and up can add tags"
  ON taggings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('foreman', 'site_manager', 'admin'))
    AND check_taggable_project_access(taggable_type, taggable_id)
  );

CREATE POLICY "Foremen and up can remove tags"
  ON taggings FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('foreman', 'site_manager', 'admin'))
    AND check_taggable_project_access(taggable_type, taggable_id)
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Seed helper: creates 4 default groups with common labels for a company
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_default_labels(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trade_id uuid;
  v_floor_id uuid;
  v_zone_id uuid;
  v_status_id uuid;
BEGIN
  -- Trade group (multi, not required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Trade', 'trade', '#3B82F6', 1, 'multi', false)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_trade_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_trade_id, 'Electrical', 'electrical', '#EF4444', 1),
    (v_trade_id, 'Plumbing', 'plumbing', '#F97316', 2),
    (v_trade_id, 'HVAC', 'hvac', '#EAB308', 3),
    (v_trade_id, 'Framing', 'framing', '#22C55E', 4),
    (v_trade_id, 'Drywall', 'drywall', '#06B6D4', 5),
    (v_trade_id, 'Painting', 'painting', '#A855F7', 6),
    (v_trade_id, 'Roofing', 'roofing', '#EC4899', 7),
    (v_trade_id, 'Concrete', 'concrete', '#78716C', 8)
  ON CONFLICT (group_id, slug) DO NOTHING;

  -- Floor group (single, not required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Floor', 'floor', '#8B5CF6', 2, 'single', false)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_floor_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_floor_id, 'Floor 1', 'floor-1', '#A78BFA', 1),
    (v_floor_id, 'Floor 2', 'floor-2', '#A78BFA', 2),
    (v_floor_id, 'Floor 3', 'floor-3', '#A78BFA', 3),
    (v_floor_id, 'Floor 4', 'floor-4', '#A78BFA', 4),
    (v_floor_id, 'Floor 5', 'floor-5', '#A78BFA', 5),
    (v_floor_id, 'Roof', 'roof', '#7C3AED', 6)
  ON CONFLICT (group_id, slug) DO NOTHING;

  -- Zone group (multi, not required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Zone', 'zone', '#10B981', 3, 'multi', false)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_zone_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_zone_id, 'Zone A', 'zone-a', '#34D399', 1),
    (v_zone_id, 'Zone B', 'zone-b', '#34D399', 2),
    (v_zone_id, 'Zone C', 'zone-c', '#34D399', 3),
    (v_zone_id, 'Exterior', 'exterior', '#059669', 4),
    (v_zone_id, 'Interior', 'interior', '#047857', 5)
  ON CONFLICT (group_id, slug) DO NOTHING;

  -- Status group (single, required)
  INSERT INTO public.label_groups (company_id, name, slug, color, sort_order, selection_mode, required)
  VALUES (p_company_id, 'Status', 'status', '#F59E0B', 4, 'single', true)
  ON CONFLICT (company_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_status_id;

  INSERT INTO public.labels (group_id, name, slug, color, sort_order) VALUES
    (v_status_id, 'Complete', 'complete', '#22C55E', 1),
    (v_status_id, 'In Progress', 'in-progress', '#3B82F6', 2),
    (v_status_id, 'Needs Review', 'needs-review', '#F97316', 3),
    (v_status_id, 'Approved', 'approved', '#16A34A', 4),
    (v_status_id, 'Rejected', 'rejected', '#EF4444', 5)
  ON CONFLICT (group_id, slug) DO NOTHING;
END;
$$;
