-- Голосовые сообщения WhatsApp и их расшифровки. САМ ФАЙЛ хранится в приватном
-- бакете Supabase Storage (storage_path), в таблице — только метаданные и текст.
-- Прямых открытых ссылок на голос не публикуем; доступ — только authenticated
-- (менеджеры) через RLS и подписанные URL. Содержимое расшифровки — недоверенные
-- пользовательские данные.
--
-- status: received | transcribed | rejected (слишком длинное/не тот тип/ошибка).

-- Приватный бакет для голосовых (public=false → нет открытых ссылок).
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-voice', 'whatsapp-voice', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS whatsapp_voice_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id           TEXT NOT NULL,
  phone             TEXT,
  message_id        TEXT,
  storage_path      TEXT,
  mime_type         TEXT,
  size_bytes        INTEGER,
  duration_seconds  NUMERIC(6, 2),
  transcript        TEXT,
  transcript_lang   TEXT,
  status            TEXT NOT NULL DEFAULT 'received',
  reject_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_voice_messages_chat
  ON whatsapp_voice_messages(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_voice_messages_message_id
  ON whatsapp_voice_messages(message_id);

DROP TRIGGER IF EXISTS whatsapp_voice_messages_updated_at ON whatsapp_voice_messages;
CREATE TRIGGER whatsapp_voice_messages_updated_at
  BEFORE UPDATE ON whatsapp_voice_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_voice_messages ENABLE ROW LEVEL SECURITY;

-- Доступ к метаданным/расшифровкам — только authenticated (менеджеры).
DROP POLICY IF EXISTS "admin_read_whatsapp_voice_messages" ON whatsapp_voice_messages;
CREATE POLICY "admin_read_whatsapp_voice_messages"
  ON whatsapp_voice_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_whatsapp_voice_messages" ON whatsapp_voice_messages;
CREATE POLICY "admin_write_whatsapp_voice_messages"
  ON whatsapp_voice_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
