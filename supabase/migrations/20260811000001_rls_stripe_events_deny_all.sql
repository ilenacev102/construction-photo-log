-- Stripe events: enable RLS with deny-all (no policies).
--
-- P2-1: stripe_events was created in 20260729000002 with no RLS and no
-- policies. The only access path is the Stripe webhook route
-- (web/app/api/subscriptions/webhook/route.ts), which uses the admin
-- (service_role) client at both the read (line ~42) and write (line ~218)
-- sites. service_role bypasses RLS, so enabling RLS cannot break the webhook.
--
-- With RLS enabled and ZERO policies, anon/authenticated are denied
-- everything: SELECT returns 0 rows (no error) and INSERT/UPDATE/DELETE raise
-- a row-level security violation. That is the correct posture for a server
-- side only idempotency table.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op when already enabled.
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE stripe_events IS
  'Stripe webhook idempotency table. RLS enabled with no policies (deny-all for anon/authenticated); only the service-role admin client of the webhook route can read/write.';
