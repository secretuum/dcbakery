CREATE TABLE IF NOT EXISTS catalog_product_overrides (
  product_id    TEXT PRIMARY KEY,
  name          TEXT,
  slug          TEXT,
  description   TEXT,
  subcategory   TEXT,
  category_slug TEXT,
  price         NUMERIC(12,2),
  unit          TEXT,
  weight_label  TEXT,
  stock_qty     NUMERIC(12,3),
  image         TEXT,
  is_active     BOOLEAN,
  is_popular    BOOLEAN,
  is_new        BOOLEAN,
  is_promo      BOOLEAN,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_product_overrides_updated_at
  ON catalog_product_overrides(updated_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS catalog_product_overrides_updated_at
  ON catalog_product_overrides;

CREATE TRIGGER catalog_product_overrides_updated_at
  BEFORE UPDATE ON catalog_product_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE catalog_product_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catalog_product_overrides'
      AND policyname = 'catalog_product_overrides_public_read'
  ) THEN
    CREATE POLICY "catalog_product_overrides_public_read"
      ON catalog_product_overrides FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catalog_product_overrides'
      AND policyname = 'catalog_product_overrides_admin_write'
  ) THEN
    CREATE POLICY "catalog_product_overrides_admin_write"
      ON catalog_product_overrides FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
