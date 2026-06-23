CREATE TABLE IF NOT EXISTS whatsapp_clients (
  chat_id          TEXT PRIMARY KEY,
  customer_phone   TEXT UNIQUE,
  company_name     TEXT,
  customer_bin     TEXT,
  customer_name    TEXT,
  customer_email   TEXT,
  delivery_address TEXT,
  delivery_date    DATE,
  delivery_time    TEXT,
  payment_method   TEXT,
  comment          TEXT,
  last_order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_clients_phone
  ON whatsapp_clients(customer_phone);

DROP TRIGGER IF EXISTS whatsapp_clients_updated_at ON whatsapp_clients;

CREATE TRIGGER whatsapp_clients_updated_at
  BEFORE UPDATE ON whatsapp_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_whatsapp_clients" ON whatsapp_clients;
CREATE POLICY "admin_read_whatsapp_clients"
  ON whatsapp_clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_whatsapp_clients" ON whatsapp_clients;
CREATE POLICY "admin_update_whatsapp_clients"
  ON whatsapp_clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_insert_whatsapp_clients" ON whatsapp_clients;
CREATE POLICY "admin_insert_whatsapp_clients"
  ON whatsapp_clients FOR INSERT TO authenticated WITH CHECK (true);
