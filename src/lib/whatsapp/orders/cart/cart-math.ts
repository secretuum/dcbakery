// Чистая математика корзины: применение операций (add/remove/set) с клэмпом по
// ОСТАТКУ и расчёт сумм. Цена и остаток — ТОЛЬКО из каталога (Product), никогда из
// сообщения. Доставка — единый deliveryFee из app/constants. Без сети/БД (тестируемо).

import type { Product } from "@/src/types";
import { deliveryFee } from "@/app/constants";
import { LIMITS } from "../config";

export type CartItemQty = { productId: string; qty: number };
export type CartOp = { productId: string; qty: number; operation: "add" | "remove" | "set" };

export type CartAdjustment = {
  productId: string;
  requested: number;
  applied: number;
  available: number;
  reason: "out_of_stock" | "clamped_to_stock";
};

export type CartLine = {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  lineTotal: number;
  weightLabel?: string;
};

export type CartView = {
  lines: CartLine[];
  itemsTotal: number;
  delivery: number;
  grandTotal: number;
};

function availableStock(product: Product): number {
  const raw = Number(product.stock_qty);
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

/** Привести желаемое количество к допустимому по остатку. */
function clampQty(
  desired: number,
  product: Product,
): { qty: number; adjustment?: Omit<CartAdjustment, "productId"> } {
  if (desired <= 0) return { qty: 0 };
  const stock = availableStock(product);
  if (stock <= 0) {
    return { qty: 0, adjustment: { requested: desired, applied: 0, available: 0, reason: "out_of_stock" } };
  }
  if (desired > stock) {
    return {
      qty: stock,
      adjustment: { requested: desired, applied: stock, available: stock, reason: "clamped_to_stock" },
    };
  }
  return { qty: desired };
}

/**
 * Применить операции к текущему составу корзины. Возвращает новый состав и список
 * корректировок (что урезали по остатку) — для честного показа клиенту.
 * Позиции с неизвестным productId игнорируются (их обрабатывает matcher/оркестратор).
 */
export function applyOps(
  existing: CartItemQty[],
  ops: CartOp[],
  productById: Map<string, Product>,
): { items: CartItemQty[]; adjustments: CartAdjustment[] } {
  const map = new Map<string, number>(existing.map((i) => [i.productId, i.qty]));
  const adjustments: CartAdjustment[] = [];

  for (const op of ops) {
    const product = productById.get(op.productId);
    if (!product) continue;

    const current = map.get(op.productId) ?? 0;
    let desired: number;
    if (op.operation === "add") desired = current + op.qty;
    // remove с положительным qty — уменьшить на столько; с нулевым/непереданным —
    // убрать позицию целиком (частая форма «убери котлеты» → remove без количества).
    else if (op.operation === "remove") desired = op.qty > 0 ? current - op.qty : 0;
    else desired = op.qty; // set
    desired = Math.min(desired, LIMITS.maxItemQuantity);

    const { qty, adjustment } = clampQty(desired, product);
    if (qty <= 0) map.delete(op.productId);
    else map.set(op.productId, qty);
    if (adjustment) adjustments.push({ productId: op.productId, ...adjustment });
  }

  const items = [...map.entries()].map(([productId, qty]) => ({ productId, qty }));
  return { items, adjustments };
}

/** Пересчитать остатки корзины по СВЕЖЕМУ каталогу (перед подтверждением/созданием). */
export function reconcileStock(
  items: CartItemQty[],
  productById: Map<string, Product>,
): { items: CartItemQty[]; adjustments: CartAdjustment[] } {
  return applyOps(
    [],
    items.map((i) => ({ productId: i.productId, qty: i.qty, operation: "set" as const })),
    productById,
  );
}

/** Собрать представление корзины с серверными ценами и доставкой. */
export function computeCartView(items: CartItemQty[], productById: Map<string, Product>): CartView {
  const lines: CartLine[] = [];
  let itemsTotal = 0;

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || item.qty <= 0) continue;
    const price = Number(product.price) || 0;
    const lineTotal = price * item.qty;
    itemsTotal += lineTotal;
    lines.push({
      productId: item.productId,
      name: product.name,
      unit: product.unit,
      qty: item.qty,
      price,
      lineTotal,
      weightLabel: product.weightLabel,
    });
  }

  const delivery = deliveryFee(itemsTotal);
  return { lines, itemsTotal, delivery, grandTotal: itemsTotal + delivery };
}
