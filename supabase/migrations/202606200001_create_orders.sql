-- DC Bakery B2B orders schema

-- ─── ORDERS ────────────────────────────────────────────────
CREATE TABLE orders (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number       TEXT        UNIQUE NOT NULL,
  company_name       TEXT        NOT NULL,
  customer_name      TEXT        NOT NULL,
  customer_phone     TEXT        NOT NULL,
  customer_email     TEXT,
  delivery_address   TEXT,
  delivery_date      DATE,
  delivery_time      TEXT,
  payment_method     TEXT,
  comment            TEXT,
  status             TEXT        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','confirmed','in_progress','ready','delivered','cancelled')),
  total_amount       NUMERIC(12,2) NOT NULL,
  telegram_message_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ORDER_ITEMS ───────────────────────────────────────────
CREATE TABLE order_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    TEXT          NOT NULL,
  product_name  TEXT          NOT NULL,
  unit          TEXT          NOT NULL,
  qty           NUMERIC(10,3) NOT NULL,
  price         NUMERIC(10,2) NOT NULL,
  total_amount  NUMERIC(12,2) NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ───────────────────────────────────────────────
CREATE INDEX idx_orders_created_at    ON orders(created_at DESC);
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ─── AUTO updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ───────────────────────────────────────────────────
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Public: INSERT only, for future client-side unauthenticated order creation.
CREATE POLICY "public_insert_orders"
  ON orders FOR INSERT WITH CHECK (true);

CREATE POLICY "public_insert_order_items"
  ON order_items FOR INSERT WITH CHECK (true);

-- Admin users: read and update orders.
CREATE POLICY "admin_read_orders"
  ON orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_update_orders"
  ON orders FOR UPDATE TO authenticated USING (true);

CREATE POLICY "admin_read_order_items"
  ON order_items FOR SELECT TO authenticated USING (true);
