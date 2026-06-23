CREATE TABLE IF NOT EXISTS whatsapp_carts (
  chat_id        TEXT PRIMARY KEY,
  customer_phone TEXT,
  sender_name    TEXT,
  items          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_carts_updated_at
  ON whatsapp_carts(updated_at DESC);

DROP TRIGGER IF EXISTS whatsapp_carts_updated_at ON whatsapp_carts;

CREATE TRIGGER whatsapp_carts_updated_at
  BEFORE UPDATE ON whatsapp_carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_whatsapp_carts" ON whatsapp_carts;
CREATE POLICY "admin_read_whatsapp_carts"
  ON whatsapp_carts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_whatsapp_carts" ON whatsapp_carts;
CREATE POLICY "admin_update_whatsapp_carts"
  ON whatsapp_carts FOR ALL TO authenticated USING (true) WITH CHECK (true);
