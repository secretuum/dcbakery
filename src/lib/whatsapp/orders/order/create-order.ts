import "server-only";
// Создание B2B-заявки из нового AI/голосового потока. НЕ параллельная модель заказа:
// переиспользуем те же примитивы, что сайт и существующий бот — insertOrderWithItems
// (единая персистентность), sendTelegramNotification / sendWhatsAppNotification (единые
// уведомления), fetchClientByPhone (привязка client_id для лимита). Отличие от старого
// createWhatsAppOrder: вход СТРУКТУРИРОВАННЫЙ (адрес/дата/интервал уже разобраны) и
// сумма включает delivery_amount = deliveryFee(позиции).

import { revalidateTag } from "next/cache";
import type { Order, OrderItem, Product } from "@/src/types";
import { deliveryFee, normalizeB2BPaymentMethod } from "@/app/constants";
import { CATALOG_CACHE_TAG } from "@/src/lib/catalog";
import { decrementProductStock } from "@/src/lib/orders/stock";
import {
  insertOrderWithItems,
  updateOrderTelegramMessageId,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { sendTelegramNotification } from "@/src/lib/telegram";
import { sendWhatsAppNotification } from "@/src/lib/whatsapp";
import { ensureClientRecord } from "@/src/lib/account/ensure-client";
import { canonicalClientPhone } from "@/src/lib/account/canonical";
import { CONSENT_VERSION } from "../config";

export type CreateOrderItem = { product: Product; qty: number };

export type CreateOrderInput = {
  chatId: string;
  /** Нормализованный телефон 7XXXXXXXXXX (как в clients.phone и на сайте). */
  phone: string;
  items: CreateOrderItem[];
  companyName: string;
  customerName: string;
  customerBin?: string | null;
  customerEmail?: string | null;
  deliveryAddress: string;
  /** YYYY-MM-DD. */
  deliveryDate: string;
  deliveryTime: string;
  comment?: string | null;
  ofertaAcceptedAtIso?: string | null;
  /** Ключ идемпотентности (обычно `wa:<messageId>`) — защита от дубля при ретрае вебхука. */
  idempotencyKey?: string | null;
};

export type CreateOrderResult = { orderId: string; orderNumber: string; order: Order };

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  // 6 цифр: 2 из времени + 4 случайные (устойчивее к коллизиям, формат совместим).
  const rand = crypto.randomUUID().replace(/\D/g, "").padEnd(4, "0").slice(0, 4);
  const time = (Date.now() % 100).toString().padStart(2, "0");
  return `DCB-${year}-${time}${rand}`;
}

function orderUnit(product: Product): string {
  return product.unit === "кг" ? "кг" : "шт.";
}

/**
 * Создать заявку (status pending_manager_confirmation) и уведомить менеджеров.
 * Идемпотентность на уровне вызова обеспечивает оркестратор (дедуп message_id +
 * гейт состояния awaiting_final_confirmation).
 */
export async function createOrderFromWhatsApp(input: CreateOrderInput): Promise<CreateOrderResult> {
  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();
  const nowIso = new Date().toISOString();

  const itemsTotal = input.items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const delivery = deliveryFee(itemsTotal);

  const orderItems: OrderItem[] = input.items.map(({ product, qty }) => ({
    category: product.category?.name ?? null,
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: product.id,
    product_name: product.name,
    unit: orderUnit(product),
    qty,
    price: product.price,
    total_amount: product.price * qty,
  }));

  // Гарантируем строку clients (credit_limit=0 ⇒ предоплата), как при регистрации на
  // сайте: WhatsApp-заказ попадает под тот же предоплатный стоп отгрузки (Патч 7) и
  // привязывается по client_id. Существующие менеджерские условия не затираются.
  const canonicalPhone = canonicalClientPhone(input.phone) ?? input.phone;
  const client = await ensureClientRecord({
    phone: input.phone,
    companyName: input.companyName,
    email: input.customerEmail ?? null,
  }).catch(() => null);

  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    source: "whatsapp",
    company_name: input.companyName,
    customer_bin: input.customerBin ?? null,
    customer_name: input.customerName,
    customer_phone: canonicalPhone,
    customer_email: input.customerEmail ?? null,
    delivery_address: input.deliveryAddress,
    delivery_date: input.deliveryDate,
    delivery_time: input.deliveryTime,
    payment_method: normalizeB2BPaymentMethod(null),
    comment: ["Заявка из WhatsApp (AI-оформление).", input.comment].filter(Boolean).join("\n"),
    status: "pending_manager_confirmation",
    total_amount: itemsTotal,
    delivery_amount: delivery,
    payment_status: "unpaid",
    client_id: client?.id ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    oferta_accepted_at: input.ofertaAcceptedAtIso ?? null,
    oferta_version: input.ofertaAcceptedAtIso ? CONSENT_VERSION : null,
    created_at: nowIso,
  };

  await insertOrderWithItems(order, orderItems);

  // Списываем остаток по каждой позиции — как на сайте (app/api/orders/route.ts),
  // иначе WhatsApp-заказы не уменьшают общий каталог ⇒ пересортовка/устаревшая
  // доступность. Best-effort: сбой списания НЕ откатывает уже сохранённый заказ.
  try {
    for (const { product, qty } of input.items) {
      await decrementProductStock(product.id, qty, Number(product.stock_qty ?? 0));
    }
    revalidateTag(CATALOG_CACHE_TAG, "max");
  } catch {
    // игнорируем — заказ уже создан, остаток подтянется при следующем пересчёте
  }

  const [whatsappMessageId, telegramMessageId] = await Promise.all([
    sendWhatsAppNotification(order, orderItems).catch(() => null),
    sendTelegramNotification(order, orderItems)
      .then((id) => (id ? String(id) : null))
      .catch(() => null),
  ]);

  await Promise.all([
    whatsappMessageId
      ? updateOrderWhatsAppMessageId(orderId, whatsappMessageId).catch(() => undefined)
      : Promise.resolve(),
    telegramMessageId
      ? updateOrderTelegramMessageId(orderId, telegramMessageId).catch(() => undefined)
      : Promise.resolve(),
  ]);

  return { orderId, orderNumber, order };
}
