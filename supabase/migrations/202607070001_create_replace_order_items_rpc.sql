CREATE OR REPLACE FUNCTION replace_order_items(
  p_order_id         uuid,
  p_items            jsonb,
  p_note             text,
  p_revision_payload jsonb
)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total numeric;
BEGIN
  DELETE FROM order_items WHERE order_id = p_order_id;

  INSERT INTO order_items
    (id, order_id, category, product_id, product_name, unit, qty, price, total_amount)
  SELECT
    gen_random_uuid(),
    p_order_id,
    (item->>'category'),
    (item->>'product_id'),
    (item->>'product_name'),
    (item->>'unit'),
    (item->>'qty')::numeric,
    (item->>'price')::numeric,
    (item->>'total_amount')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total
    FROM order_items
   WHERE order_id = p_order_id;

  RETURN QUERY
  UPDATE orders
     SET payment_status        = 'unpaid',
         payment_url           = NULL,
         revision_note         = p_note,
         revision_payload      = p_revision_payload,
         revision_requested_at = NOW(),
         status                = 'change_proposed',
         total_amount          = v_total
   WHERE id = p_order_id
   RETURNING *;
END;
$$;
