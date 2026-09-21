-- Create permissions system for granular role-based access control
-- This migration adds:
--   1. permissions table — defines all available permissions
--   2. role_permissions table — default permissions per role
--   3. user_permissions table — per-user overrides (grant/deny)

-- ── 1. Permissions catalog ──

CREATE TABLE IF NOT EXISTS permissions (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read permissions (they're just a catalog)
CREATE POLICY "Anyone can read permissions"
  ON permissions FOR SELECT
  USING (true);

-- ── 2. Role-permission defaults ──

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('photographer','foreman','site_manager','client','admin')),
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read role_permissions"
  ON role_permissions FOR SELECT
  USING (true);

-- ── 3. User-specific permission overrides ──

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own permission overrides"
  ON user_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers and admins read all user_permissions"
  ON user_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'site_manager')
    )
  );

CREATE POLICY "Admins can manage user_permissions"
  ON user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Managers can manage their team's user_permissions"
  ON user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'site_manager')
    )
  );

-- ── 4. Seed permission catalog ──

INSERT INTO permissions (key, name, description, category) VALUES
  -- Photos
  ('photo.upload',   'Upload Photos',       'Can upload photos to projects', 'photos'),
  ('photo.delete',   'Delete Photos',       'Can delete photos from projects', 'photos'),
  ('photo.view',     'View Photos',         'Can view project photos', 'photos'),
  -- Defects
  ('defect.create',  'Create Defects',      'Can create defect items', 'defects'),
  ('defect.update',  'Update Defects',      'Can update defect status/details', 'defects'),
  ('defect.delete',  'Delete Defects',      'Can delete defects', 'defects'),
  ('defect.view',    'View Defects',        'Can view defect list', 'defects'),
  -- Projects
  ('project.create', 'Create Projects',     'Can create new projects', 'projects'),
  ('project.delete', 'Delete Projects',     'Can delete projects', 'projects'),
  ('project.view',   'View Projects',       'Can view project details', 'projects'),
  -- Attendance
  ('attendance.manage', 'Manage Attendance','Can check in/out and edit attendance', 'attendance'),
  ('attendance.view',   'View Attendance',  'Can view attendance logs', 'attendance'),
  -- Daily Logs
  ('daily_log.create', 'Create Daily Logs', 'Can create daily log entries', 'daily_logs'),
  ('daily_log.delete', 'Delete Daily Logs', 'Can delete daily log entries', 'daily_logs'),
  -- Reports
  ('report.generate', 'Generate Reports',   'Can generate PDF reports', 'reports'),
  -- Drawing Pins
  ('pins.manage',    'Manage Drawing Pins', 'Can add/edit/delete drawing pins on photos', 'pins'),
  -- User Management
  ('user.manage',    'Manage Users',        'Can change user roles and permissions', 'users'),
  ('user.invite',    'Invite Users',        'Can invite new users to the platform', 'users'),
  ('team.manage',    'Manage Team',         'Can manage team members on projects', 'users'),
  -- Admin
  ('admin.access',   'Admin Access',        'Can access the admin panel', 'admin'),
  ('admin.audit',    'View Audit Log',      'Can view audit log', 'admin')
ON CONFLICT (key) DO NOTHING;

-- ── 5. Seed role-permission defaults ──

-- Admin: everything
INSERT INTO role_permissions (role, permission_key)
SELECT 'admin', key FROM permissions
ON CONFLICT DO NOTHING;

-- Site Manager: nearly everything except admin.access and admin.audit
INSERT INTO role_permissions (role, permission_key)
SELECT 'site_manager', key FROM permissions
WHERE key NOT IN ('admin.access', 'admin.audit', 'user.manage')
ON CONFLICT DO NOTHING;

-- Also give site_manager user.manage (they manage their team)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('site_manager', 'user.manage'),
  ('site_manager', 'admin.audit')
ON CONFLICT DO NOTHING;

-- Foreman: operational
INSERT INTO role_permissions (role, permission_key) VALUES
  ('foreman', 'photo.upload'),
  ('foreman', 'photo.view'),
  ('foreman', 'photo.delete'),
  ('foreman', 'defect.create'),
  ('foreman', 'defect.update'),
  ('foreman', 'defect.view'),
  ('foreman', 'project.view'),
  ('foreman', 'attendance.manage'),
  ('foreman', 'attendance.view'),
  ('foreman', 'daily_log.create'),
  ('foreman', 'pins.manage'),
  ('foreman', 'report.generate')
ON CONFLICT DO NOTHING;

-- Photographer: upload-focused
INSERT INTO role_permissions (role, permission_key) VALUES
  ('photographer', 'photo.upload'),
  ('photographer', 'photo.view'),
  ('photographer', 'defect.view'),
  ('photographer', 'project.view'),
  ('photographer', 'attendance.view'),
  ('photographer', 'pins.manage')
ON CONFLICT DO NOTHING;

-- Client: read-only
INSERT INTO role_permissions (role, permission_key) VALUES
  ('client', 'photo.view'),
  ('client', 'defect.view'),
  ('client', 'project.view'),
  ('client', 'attendance.view'),
  ('client', 'report.generate')
ON CONFLICT DO NOTHING;

-- ── 6. Helper function: get effective permissions for a user ──

CREATE OR REPLACE FUNCTION get_user_permissions(target_user_id uuid)
RETURNS TABLE (permission_key text, granted boolean)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the user's role
  SELECT p.role INTO user_role FROM profiles p WHERE p.id = target_user_id;

  RETURN QUERY
  -- Role defaults + user overrides, where override wins
  SELECT DISTINCT ON (rp.permission_key)
    rp.permission_key,
    COALESCE(up.granted, true) AS granted
  FROM role_permissions rp
  LEFT JOIN user_permissions up
    ON up.permission_key = rp.permission_key
    AND up.user_id = target_user_id
  WHERE rp.role = user_role
  ORDER BY rp.permission_key;

  -- Also include explicitly granted user overrides for non-role permissions
  RETURN QUERY
  SELECT up.permission_key, up.granted
  FROM user_permissions up
  WHERE up.user_id = target_user_id
    AND up.permission_key NOT IN (
      SELECT rp.permission_key
      FROM role_permissions rp
      WHERE rp.role = user_role
    );
END;
$$;

-- ── 7. Helper: check if user has a specific permission ──

CREATE OR REPLACE FUNCTION user_has_permission(target_user_id uuid, perm_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  has_perm boolean;
BEGIN
  -- First check user overrides
  SELECT granted INTO has_perm
  FROM user_permissions
  WHERE user_id = target_user_id AND permission_key = perm_key;

  IF FOUND THEN
    RETURN has_perm;
  END IF;

  -- Then check role defaults
  SELECT true INTO has_perm
  FROM role_permissions rp
  JOIN profiles p ON p.id = target_user_id
  WHERE rp.role = p.role AND rp.permission_key = perm_key;

  RETURN FOUND;
END;
$$;
