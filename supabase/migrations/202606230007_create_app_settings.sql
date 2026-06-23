CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS app_settings_updated_at
  ON app_settings;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = 'app_settings_admin_read'
  ) THEN
    CREATE POLICY "app_settings_admin_read"
      ON app_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = 'app_settings_admin_write'
  ) THEN
    CREATE POLICY "app_settings_admin_write"
      ON app_settings FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO app_settings(key, value)
VALUES
  ('whatsapp_bot_enabled', 'true'),
  ('whatsapp_customer_bot_enabled', 'true'),
  ('whatsapp_manager_commands_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
