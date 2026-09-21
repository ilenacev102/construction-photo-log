-- Create defects/punch list system
DO $$ BEGIN
  CREATE TYPE defect_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE defect_status AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  assigned_to uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text DEFAULT '',
  severity defect_severity NOT NULL DEFAULT 'medium',
  status defect_status NOT NULL DEFAULT 'open',
  location text DEFAULT '',
  photo_ids uuid[] DEFAULT '{}',
  due_date date,
  resolved_at timestamptz,
  resolution_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_defects_project ON defects(project_id);
CREATE INDEX IF NOT EXISTS idx_defects_status ON defects(status);
CREATE INDEX IF NOT EXISTS idx_defects_project_status ON defects(project_id, status);

ALTER TABLE defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view defects in their projects"
  ON defects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND (
        projects.user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'foreman', 'admin'))
      )
    )
  );

CREATE POLICY "Foremen and up can create defects"
  ON defects FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('foreman', 'site_manager', 'admin'))
  );

CREATE POLICY "Assigned users and managers can update defects"
  ON defects FOR UPDATE
  USING (
    auth.uid() = assigned_to OR
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
  );

CREATE POLICY "Managers can delete defects"
  ON defects FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin'))
  );
