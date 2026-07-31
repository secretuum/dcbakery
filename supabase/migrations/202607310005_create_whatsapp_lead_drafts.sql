-- Черновики лида для менеджера: когда клиент не завершил оформление, попросил
-- человека, столкнулся с ошибкой или прислал нестандартный запрос. Одна активная
-- запись на чат (chat_id UNIQUE → upsert). Уходит в существующий Telegram-чат
-- менеджеров (telegram_message_id связывает с карточкой). Второй менеджерский
-- канал НЕ создаём.
--
-- stage  — состояние диалога, на котором клиент остановился (DialogState).
-- status — open | claimed | closed.

CREATE TABLE IF NOT EXISTS whatsapp_lead_drafts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id                TEXT NOT NULL UNIQUE,
  phone                  TEXT,
  provisional_name       TEXT,
  cart                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  address                TEXT,
  delivery_period        TEXT,
  stage                  TEXT,
  reason                 TEXT,
  last_voice_transcript  TEXT,
  status                 TEXT NOT NULL DEFAULT 'open',
  telegram_message_id    TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_lead_drafts_status
  ON whatsapp_lead_drafts(status, updated_at DESC);

DROP TRIGGER IF EXISTS whatsapp_lead_drafts_updated_at ON whatsapp_lead_drafts;
CREATE TRIGGER whatsapp_lead_drafts_updated_at
  BEFORE UPDATE ON whatsapp_lead_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_lead_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_whatsapp_lead_drafts" ON whatsapp_lead_drafts;
CREATE POLICY "admin_read_whatsapp_lead_drafts"
  ON whatsapp_lead_drafts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_whatsapp_lead_drafts" ON whatsapp_lead_drafts;
CREATE POLICY "admin_write_whatsapp_lead_drafts"
  ON whatsapp_lead_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);
