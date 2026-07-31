-- Дедупликация входящих сообщений WhatsApp (идемпотентность webhook).
-- Green API/Meta могут прислать одно сообщение несколько раз (ретраи); а также
-- пользователь может задвоить нажатие. Первичный ключ = message_id провайдера:
-- повторная вставка того же id падает по PK → обработчик понимает «уже видели».
-- Строки иммутабельны (без updated_at/триггера).

CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
  message_id  TEXT PRIMARY KEY,
  chat_id     TEXT,
  kind        TEXT,
  outcome     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Для периодической очистки старых записей (ретеншн).
CREATE INDEX IF NOT EXISTS idx_whatsapp_processed_messages_created_at
  ON whatsapp_processed_messages(created_at);

ALTER TABLE whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_whatsapp_processed_messages" ON whatsapp_processed_messages;
CREATE POLICY "admin_read_whatsapp_processed_messages"
  ON whatsapp_processed_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_whatsapp_processed_messages" ON whatsapp_processed_messages;
CREATE POLICY "admin_write_whatsapp_processed_messages"
  ON whatsapp_processed_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
