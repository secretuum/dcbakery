import type { OrderItem, Product } from "@/src/types";

export type AccountGroupKey = "bakery" | "pf";

export const accountGroupLabels: Record<AccountGroupKey, string> = {
  bakery: "Пекарня",
  pf: "Цех полуфабрикатов",
};

// Категории, отгружаемые цехом полуфабрикатов; всё остальное — пекарня.
// Товар, удалённый из каталога, попадает на основной счёт «Пекарня».
const PF_CATEGORY_SLUGS = new Set(["polufabrikaty", "myaso"]);

export function splitItemsByAccount(items: OrderItem[], products: Product[]) {
  const categoryByProductId = new Map(
    products.map((product) => [product.id, product.category?.slug]),
  );
  const groups: Record<AccountGroupKey, OrderItem[]> = { bakery: [], pf: [] };

  for (const item of items) {
    const slug = categoryByProductId.get(item.product_id);
    groups[slug && PF_CATEGORY_SLUGS.has(slug) ? "pf" : "bakery"].push(item);
  }

  return groups;
}

export function sumItems(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.total_amount, 0);
}
