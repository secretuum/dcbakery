import type { Product } from "@/src/types";

// Подбор «похожих товаров» для низа страницы товара. Зачем вообще: страницы
// товаров были листьями — в HTML страницы товара ноль ссылок вида /{locale}/product/…,
// краулер приходил и уходил, вес дальше не тёк. Каталог мы связали раньше, тут
// связываем товары между собой внутри раздела.
//
// Функция ЧИСТАЯ и ничего не грузит: товары раздела передаёт вызывающий
// (fetchProductsByCategory), а здесь остаётся только правило отбора — его можно
// накрыть тестами без next/cache и supabase.

/** Сколько карточек показываем максимум: две строки по четыре на широком экране. */
export const SIMILAR_PRODUCTS_LIMIT = 8;

/**
 * Есть ли товар в наличии. Формула ровно та же, что в ProductCard: остатка
 * должно хватать на минимальный заказ (и хотя бы на одну штуку). Держим её
 * здесь же, чтобы «в наличии первыми» в подборе и зелёная метка на карточке
 * не разъехались.
 */
export function isProductInStock(product: Pick<Product, "stock_qty" | "min_qty">): boolean {
  return product.stock_qty >= Math.max(product.min_qty, 1);
}

type PickSimilarProductsOptions = {
  /** Товары того же раздела, включая текущий — его отфильтруем сами. */
  products: Product[];
  /** Slug товара, чью страницу показываем: сам на себя товар не ссылается. */
  currentSlug: string;
  limit?: number;
};

/**
 * Список похожих товаров: тот же раздел, без текущего, в наличии первыми.
 *
 * Порядок ДЕТЕРМИНИРОВАН — один вход даёт один и тот же список. Это важно не
 * ради красоты: страница товара пререндерится, и «случайная» подборка давала бы
 * разный HTML на разных сборках, а с ним — пляшущую перелинковку и разные
 * снапшоты в тестах. Сортировка полная: наличие → sort_order → slug. Последний
 * ключ нужен как тай-брейк, иначе при совпадении sort_order порядок зависел бы
 * от того, в каком порядке товары пришли из каталога.
 */
export function pickSimilarProducts({
  products,
  currentSlug,
  limit = SIMILAR_PRODUCTS_LIMIT,
}: PickSimilarProductsOptions): Product[] {
  if (limit <= 0) {
    return [];
  }

  return products
    .filter((product) => product.slug !== currentSlug)
    .slice()
    .sort((a, b) => {
      const stockRank = Number(isProductInStock(b)) - Number(isProductInStock(a));

      if (stockRank !== 0) {
        return stockRank;
      }

      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }

      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    })
    .slice(0, limit);
}
