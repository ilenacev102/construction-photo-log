-- Create attendance tracking for QR check-in/out
CREATE TABLE IF NOT EXISTS attendance_logs (
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

CREATE INDEX IF NOT EXISTS idx_attendance_project_date ON attendance_logs(project_id, check_in);

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

-- Managers/admins can view all attendance for their projects
CREATE POLICY "Managers view project attendance"
  ON attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('site_manager', 'admin')
    )
  );
