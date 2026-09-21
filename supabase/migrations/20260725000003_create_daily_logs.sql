-- Create daily_logs table
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  weather text,
  temperature text,
  work_description text NOT NULL DEFAULT '',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for faster queries by project + date
CREATE INDEX IF NOT EXISTS idx_daily_logs_project_date 
  ON daily_logs(project_id, log_date DESC);

-- Enable RLS
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own daily logs"
  ON daily_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily logs"
  ON daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily logs"
  ON daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily logs"
  ON daily_logs FOR DELETE
  USING (auth.uid() = user_id);
