-- Track oferta acceptance at the time of order creation
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS oferta_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oferta_version     TEXT;
