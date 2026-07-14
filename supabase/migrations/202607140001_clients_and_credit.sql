-- B2B client entities with credit terms (separate from whatsapp_clients)
CREATE TABLE IF NOT EXISTS clients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  contract_no          TEXT,
  email                TEXT,
  phone                TEXT,
  credit_limit         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_terms_days   INTEGER NOT NULL DEFAULT 7,
  grace_days           INTEGER NOT NULL DEFAULT 3,
  price_list_id        TEXT,
  iiko_counteragent_id TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'prepay_only', 'blocked')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_phone
  ON clients(phone) WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email
  ON clients(email) WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_clients" ON clients;
CREATE POLICY "admin_all_clients" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Extend orders with credit and shipment fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipment_date DATE,
  ADD COLUMN IF NOT EXISTS due_date      DATE;

CREATE INDEX IF NOT EXISTS idx_orders_client_id
  ON orders(client_id);

CREATE INDEX IF NOT EXISTS idx_orders_client_payment
  ON orders(client_id, payment_status)
  WHERE client_id IS NOT NULL;
