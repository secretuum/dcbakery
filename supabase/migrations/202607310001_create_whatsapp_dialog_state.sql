-- Персистентное состояние диалога оформления заказа через WhatsApp (state-machine).
-- Одна строка на клиентский чат. In-memory Map недостаточно (теряется при рестарте
-- и не работает на нескольких инстансах) — состояние храним здесь.
--
-- state    — одно из значений DialogState (src/lib/whatsapp/orders/state/machine.ts).
-- context  — рабочие данные шага (варианты уточнения, кандидат адреса, интервал,
--            id черновика заказа и т.п.); строго серверные, клиент их не задаёт.
-- lock_*   — оптимистичная блокировка от параллельной обработки двух сообщений
--            одного чата (см. concurrency в оркестраторе).

CREATE TABLE IF NOT EXISTS whatsapp_dialog_state (
  chat_id          TEXT PRIMARY KEY,
  phone            TEXT,
  state            TEXT NOT NULL DEFAULT 'idle',
  context          JSONB NOT NULL DEFAULT '{}'::jsonb,
  handoff_reason   TEXT,
  lock_token       TEXT,
  locked_until     TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_dialog_state_last_activity
  ON whatsapp_dialog_state(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_dialog_state_state
  ON whatsapp_dialog_state(state);

DROP TRIGGER IF EXISTS whatsapp_dialog_state_updated_at ON whatsapp_dialog_state;
CREATE TRIGGER whatsapp_dialog_state_updated_at
  BEFORE UPDATE ON whatsapp_dialog_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_dialog_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_whatsapp_dialog_state" ON whatsapp_dialog_state;
CREATE POLICY "admin_read_whatsapp_dialog_state"
  ON whatsapp_dialog_state FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_whatsapp_dialog_state" ON whatsapp_dialog_state;
CREATE POLICY "admin_write_whatsapp_dialog_state"
  ON whatsapp_dialog_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
