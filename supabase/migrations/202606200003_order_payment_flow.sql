BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_bin TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_provider_check;

UPDATE orders
SET status = CASE status
  WHEN 'new' THEN 'pending_manager_confirmation'
  WHEN 'confirmed' THEN 'confirmed_waiting_payment'
  WHEN 'ready' THEN 'completed'
  WHEN 'delivered' THEN 'completed'
  WHEN 'cancelled' THEN 'canceled'
  ELSE status
END
WHERE status IN ('new', 'confirmed', 'ready', 'delivered', 'cancelled');

UPDATE orders SET source = 'website' WHERE source IS NULL OR source = '';
UPDATE orders SET payment_status = 'unpaid' WHERE payment_status IS NULL OR payment_status = '';

ALTER TABLE orders ALTER COLUMN source SET DEFAULT 'website';
ALTER TABLE orders ALTER COLUMN source SET NOT NULL;
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'unpaid';
ALTER TABLE orders ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending_manager_confirmation';

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_manager_confirmation',
    'confirmed_waiting_payment',
    'paid',
    'in_progress',
    'delivering',
    'completed',
    'canceled'
  ));

ALTER TABLE orders
  ADD CONSTRAINT orders_source_check
  CHECK (source IN ('website', 'whatsapp', 'admin'));

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    'unpaid',
    'payment_link_created',
    'payment_link_sent',
    'paid',
    'failed',
    'expired',
    'refunded'
  ));

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_provider_check
  CHECK (
    payment_provider IS NULL
    OR payment_provider IN ('halyk', 'freedom', 'manual', 'kaspi_later')
  );

CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id);

COMMIT;
