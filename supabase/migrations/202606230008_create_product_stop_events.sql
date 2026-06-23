CREATE TABLE IF NOT EXISTS product_stop_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          TEXT NOT NULL,
  product_name        TEXT NOT NULL,
  reason              TEXT,
  source              TEXT NOT NULL DEFAULT 'admin',
  reported_by_chat_id TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_stop_events_product_id
  ON product_stop_events(product_id);

CREATE INDEX IF NOT EXISTS idx_product_stop_events_active
  ON product_stop_events(product_id, started_at DESC)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_stop_events_started_at
  ON product_stop_events(started_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS product_stop_events_updated_at
  ON product_stop_events;

CREATE TRIGGER product_stop_events_updated_at
  BEFORE UPDATE ON product_stop_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE product_stop_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_stop_events'
      AND policyname = 'product_stop_events_admin_read'
  ) THEN
    CREATE POLICY "product_stop_events_admin_read"
      ON product_stop_events FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_stop_events'
      AND policyname = 'product_stop_events_admin_write'
  ) THEN
    CREATE POLICY "product_stop_events_admin_write"
      ON product_stop_events FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
