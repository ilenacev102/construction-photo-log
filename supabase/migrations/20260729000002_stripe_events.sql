-- Stripe webhook idempotency table
-- Prevents double-processing of the same Stripe event
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add Stripe event timestamp for race-condition protection
-- Each webhook event carries a monotic `created` (Unix seconds) from Stripe.
-- By storing it alongside each subscription update, we can reject stale
-- events that arrive out of order.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_event_created bigint;
