BEGIN;

DROP POLICY IF EXISTS "public_insert_orders" ON orders;
DROP POLICY IF EXISTS "public_insert_order_items" ON order_items;

REVOKE INSERT ON orders FROM anon;
REVOKE INSERT ON order_items FROM anon;

COMMIT;
