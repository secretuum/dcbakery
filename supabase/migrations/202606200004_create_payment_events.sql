CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  payment_id TEXT,
  provider TEXT CHECK (
    provider IS NULL
    OR provider IN ('halyk', 'freedom', 'manual', 'kaspi_later')
  ),
  status TEXT CHECK (
    status IS NULL
    OR status IN ('unpaid', 'payment_link_created', 'payment_link_sent', 'paid', 'failed', 'expired', 'refunded')
  ),
  amount NUMERIC(12,2),
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON payment_events(created_at DESC);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_payment_events" ON payment_events;

CREATE POLICY "admin_read_payment_events"
  ON payment_events FOR SELECT TO authenticated USING (true);
