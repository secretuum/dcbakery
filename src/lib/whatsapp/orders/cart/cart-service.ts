import "server-only";
// Серверная корзина оформления через WhatsApp. Хранилище — существующая таблица
// whatsapp_carts (не заводим второе): переиспользуем whatsapp-cart-store. Здесь —
// применение операций со свежей проверкой остатка и сборка представления.
// TTL сессии (60 мин) отслеживается по whatsapp_dialog_state.last_activity_at на
// уровне оркестратора — тут только состав/остаток/суммы.

import type { Product } from "@/src/types";
import {
  fetchWhatsAppCart,
  saveWhatsAppCart,
  clearWhatsAppCart,
} from "@/src/lib/whatsapp-cart-store";
import {
  applyOps,
  computeCartView,
  reconcileStock,
  type CartOp,
  type CartView,
  type CartAdjustment,
  type CartItemQty,
} from "./cart-math";

export type CartMeta = { phone?: string | null; senderName?: string | null };

function toProductMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((p) => [p.id, p]));
}

/** Текущее представление корзины со СВЕЖИМ пересчётом остатка. */
export async function loadCartView(
  chatId: string,
  products: Product[],
): Promise<{ view: CartView; adjustments: CartAdjustment[] }> {
  const productById = toProductMap(products);
  const cart = await fetchWhatsAppCart(chatId);
  const { items, adjustments } = reconcileStock(cart.items, productById);
  // Если пересчёт что-то урезал — сохраняем «вычищенную» корзину.
  if (adjustments.length > 0) {
    await saveWhatsAppCart({ chatId, customerPhone: cart.customerPhone, senderName: cart.senderName, items });
  }
  return { view: computeCartView(items, productById), adjustments };
}

/** Применить операции (add/remove/set) с клэмпом по остатку и сохранить. */
export async function applyCartOps(
  chatId: string,
  meta: CartMeta,
  ops: CartOp[],
  products: Product[],
): Promise<{ view: CartView; adjustments: CartAdjustment[] }> {
  const productById = toProductMap(products);
  const cart = await fetchWhatsAppCart(chatId);
  const { items, adjustments } = applyOps(cart.items, ops, productById);
  await saveWhatsAppCart({
    chatId,
    customerPhone: meta.phone ?? cart.customerPhone ?? null,
    senderName: meta.senderName ?? cart.senderName ?? null,
    items,
  });
  return { view: computeCartView(items, productById), adjustments };
}

/** Перезаписать состав корзины (напр. при повторе прошлого заказа) с клэмпом. */
export async function setCartItems(
  chatId: string,
  meta: CartMeta,
  items: CartItemQty[],
  products: Product[],
): Promise<{ view: CartView; adjustments: CartAdjustment[] }> {
  const productById = toProductMap(products);
  const cart = await fetchWhatsAppCart(chatId);
  const { items: clamped, adjustments } = reconcileStock(items, productById);
  await saveWhatsAppCart({
    chatId,
    // Сохраняем существующие телефон/имя, а не затираем в null (как applyCartOps).
    customerPhone: meta.phone ?? cart.customerPhone ?? null,
    senderName: meta.senderName ?? cart.senderName ?? null,
    items: clamped,
  });
  return { view: computeCartView(clamped, productById), adjustments };
}

export async function clearCart(chatId: string): Promise<void> {
  await clearWhatsAppCart(chatId);
}

/** Текущий состав корзины (без пересчёта) — для оркестратора. */
export async function getCartItems(chatId: string): Promise<CartItemQty[]> {
  const cart = await fetchWhatsAppCart(chatId);
  return cart.items;
}
