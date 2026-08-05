import "server-only";
// Атомарное списание остатка через RPC decrement_product_stock (миграция 202608030001).
// Заменяет read-modify-write: декремент считается в БД, гонка/двойное списание исключены.
// fallbackStock — эффективный остаток из приложения (для товара без оверрайд-строки,
// используется только при первом INSERT внутри RPC).

const SUPABASE_TIMEOUT_MS = 10000;

function serviceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin credentials are not configured");
  return { restUrl: `${url.replace(/\/$/, "")}/rest/v1`, key };
}

/**
 * Списывает остаток атомарно. Возвращает true, если списание применилось; false —
 * если остатка не хватило (условный RPC вернул NULL ⇒ гонка/oversell: заказ прошёл
 * валидацию по устаревшему кэш-остатку, а в БД товара уже нет). До применения
 * условной миграции RPC всегда возвращает число ⇒ функция вернёт true (ложных
 * срабатываний нет, поведение как раньше). Бросает только на транспортной ошибке.
 */
export async function decrementProductStock(
  productId: string,
  qty: number,
  fallbackStock: number,
): Promise<boolean> {
  const { restUrl, key } = serviceConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  try {
    const res = await fetch(`${restUrl}/rpc/decrement_product_stock`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_product_id: productId, p_qty: qty, p_fallback_stock: fallbackStock }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`decrement_product_stock failed: ${res.status}`);
    }
    // RPC возвращает новый остаток (число) при успехе или NULL при нехватке.
    const value = (await res.json()) as number | null;
    return value !== null;
  } finally {
    clearTimeout(timer);
  }
}
