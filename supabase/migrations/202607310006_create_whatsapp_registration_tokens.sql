-- Одноразовые регистрационные токены для WhatsApp-клиентов. В БД хранится ТОЛЬКО
-- ХЭШ токена (sha256), не сам токен. Ссылка открывает форму регистрации с
-- подставленным номером; сессия по клику НЕ выдаётся. Токен: single-use + TTL +
-- привязан к номеру. Погашение атомарно (UPDATE только по used=false && не истёк).

CREATE TABLE IF NOT EXISTS whatsapp_registration_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  purpose     TEXT NOT NULL DEFAULT 'registration',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_reg_tokens_hash
  ON whatsapp_registration_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_whatsapp_reg_tokens_expiry
  ON whatsapp_registration_tokens(expires_at);

ALTER TABLE whatsapp_registration_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_whatsapp_reg_tokens" ON whatsapp_registration_tokens;
CREATE POLICY "admin_read_whatsapp_reg_tokens"
  ON whatsapp_registration_tokens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_whatsapp_reg_tokens" ON whatsapp_registration_tokens;
CREATE POLICY "admin_write_whatsapp_reg_tokens"
  ON whatsapp_registration_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);
