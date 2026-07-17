import "server-only";
import { unstable_cache } from "next/cache";

// Популярность товаров: сколько единиц каждой позиции реально заказали.
// Считается по order_items (только чтение), кэшируется на 30 минут.
// Используется сортировкой «По популярности» в каталоге и блоком «Популярное».

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

async function loadOrderCounts(): Promise<Record<string, number>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {};
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/order_items?select=product_id,qty`;
  const counts: Record<string, number> = {};

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const response = await fetch(baseUrl, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Range: `${from}-${from + PAGE_SIZE - 1}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        break;
      }

      const rows = (await response.json()) as Array<{ product_id?: string; qty?: number }>;

      for (const row of rows) {
        if (!row.product_id) {
          continue;
        }
        counts[row.product_id] = (counts[row.product_id] ?? 0) + (Number(row.qty) || 0);
      }

      if (rows.length < PAGE_SIZE) {
        break;
      }
    }
  } catch {
    // Каталог должен работать и без статистики
  }

  return counts;
}

export const fetchProductOrderCounts = unstable_cache(loadOrderCounts, ["product-order-counts"], {
  revalidate: 1800,
});
