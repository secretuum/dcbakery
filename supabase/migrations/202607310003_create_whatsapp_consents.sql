-- Журнал согласий на создание профиля / обработку данных (источник whatsapp).
-- Фиксируем версию текста согласия, номер, id сообщения-подтверждения и время —
-- append-only (историю согласий не перезаписываем).

CREATE TABLE IF NOT EXISTS whatsapp_consents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            TEXT NOT NULL,
  chat_id          TEXT,
  consent_version  TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'whatsapp',
  message_id       TEXT,
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_consents_phone
  ON whatsapp_consents(phone, accepted_at DESC);

ALTER TABLE whatsapp_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_whatsapp_consents" ON whatsapp_consents;
CREATE POLICY "admin_read_whatsapp_consents"
  ON whatsapp_consents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_whatsapp_consents" ON whatsapp_consents;
CREATE POLICY "admin_write_whatsapp_consents"
  ON whatsapp_consents FOR ALL TO authenticated USING (true) WITH CHECK (true);
