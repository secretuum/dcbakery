BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_actor TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS revision_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS revision_payload JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_response_at TIMESTAMPTZ;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_manager_confirmation',
    'change_proposed',
    'confirmed_waiting_payment',
    'paid',
    'in_progress',
    'delivering',
    'completed',
    'canceled'
  ));

COMMIT;
