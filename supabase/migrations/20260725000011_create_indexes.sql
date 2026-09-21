-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Existing tables - critical indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_project_id ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_photos_project_date ON photos(project_id, taken_at DESC);

-- Future tables (will be created in other migrations, safe to index preemptively)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_defects_project_status ON defects(project_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_project_checkin ON attendance_logs(project_id, check_in DESC);

-- Full-text search on project names
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);
