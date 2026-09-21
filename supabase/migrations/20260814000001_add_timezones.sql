-- Canonical per-project timezone (IANA) day-key layer.
-- Storage stays UTC (timestamptz); these columns only drive display/day-key bucketing.

ALTER TABLE companies ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';

ALTER TABLE projects ADD COLUMN timezone text;

-- Reconcile DB-side "today" with UTC storage (log_date stays a date).
ALTER TABLE daily_logs ALTER COLUMN log_date SET DEFAULT (CURRENT_DATE AT TIME ZONE 'UTC'::text)::date;