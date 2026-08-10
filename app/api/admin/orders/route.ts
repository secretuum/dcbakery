import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { deliveryFee } from "@/app/constants";
import { CATALOG_CACHE_TAG, fetchProducts } from "@/src/lib/catalog";
import { resolveCartItems, validateOrderFields } from "@/src/lib/orders/order-validation";
import { getSiteContent } from "@/src/lib/site-content";
import {
  fetchClientByPhone,
  getSupabaseAdminConfigError,
  insertOrderWithItems,
} from "@/src/lib/supabase/admin";
import { decrementProductStock } from "@/src/lib/orders/stock";
import { getAdminEmail } from "@/src/lib/admin-identity";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";
import { sendWhatsAppNotification } from "@/src/lib/whatsapp";
import { sendTelegramNotification } from "@/src/lib/telegram";
import { reportError } from "@/src/lib/monitoring";
import type { Order, OrderItem } from "@/src/types";

// Заказ, оформленный СОТРУДНИКОМ (торгпред/админ) от имени клиента (стадия 3 фичи
// торгпредов). Переиспускает клиентский флоу (resolveCartItems + validateOrderFields +
// insertOrderWithItems), НЕ трогая защищённую логику. Заказ уходит в статус
// pending_manager_confirmation → принимает его только админ (гейт proxy блокирует
// подтверждение для торгпреда). Атрибуция v1 — в комментарии.

const OFERTA_VERSION = "2026-07-14";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function asString(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return lower === "null" || lower === "undefined" ? "" : trimmed;
}
function asPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function generateOrderNumber() {
  const year = new Date().getFullYear();
  const suffix = Date.now().toString().slice(-6);
  const rand = crypto.randomUUID().slice(0, 4);
  return `DCB-${year}-${suffix}-${rand}`;
}

export async function POST(request: Request) {
  // Авторизация сотрудника (admin ИЛИ manager). getAdminEmail вернёт email только
  // сотруднику; заодно это атрибуция «кто оформил». Маршрут ещё и закрыт proxy-гейтом.
  const actorEmail = await getAdminEmail();
  if (!actorEmail) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const configError = getSupabaseAdminConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const raw = isRecord(payload) ? payload : {};
  const chatId = asString(raw.chatId);
  const deliveryDate = asString(raw.deliveryDate);
  const deliveryTime = asString(raw.deliveryTime);
  const paymentMethod = asString(raw.paymentMethod) || "Выставить счет";
  const comment = asString(raw.comment);
  const requestAvr = raw.requestAvr === true;

  if (!chatId) {
    return NextResponse.json({ error: "Выберите клиента" }, { status: 422 });
  }

  const profile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }

  // Позиции: цены/названия берём с сервера из каталога (тело не диктует цену).
  const products = await fetchProducts();
  const incoming = (Array.isArray(raw.items) ? raw.items : [])
    .filter(isRecord)
    .map((item) => ({ product_id: asString(item.product_id), qty: asPositiveNumber(item.qty) }))
    .filter((item) => item.product_id && item.qty > 0);
  const { errors: itemErrors, productMap, resolvedItems } = resolveCartItems(incoming, products);

  const bodyItems = resolvedItems.map((item) => {
    const product = productMap.get(item.product_id);
    return {
      product_id: item.product_id,
      qty: item.qty,
      price: product?.price ?? 0,
      product_name: product?.name ?? item.product_id,
      total_amount: (product?.price ?? 0) * item.qty,
      unit: product?.unit ?? "шт",
    };
  });

  const companyName = profile.companyName ?? "";
  const phone = profile.customerPhone ?? "";
  // Реквизиты берём из профиля клиента; оферту сотрудник принимает от его имени.
  const validationBody = {
    company_name: companyName,
    customer_name: profile.customerName ?? companyName,
    customer_phone: phone,
    delivery_date: deliveryDate,
    payment_method: paymentMethod,
    items: bodyItems,
    oferta_accepted: true,
  };
  const siteContent = await getSiteContent().catch(() => null);
  const deliveryDays = siteContent?.deliveryDays ?? [2, 4, 6];
  const { errors, totalAmount } = validateOrderFields(validationBody, deliveryDays, getTomorrowDate());
  errors.push(...itemErrors);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const digits = phone.replace(/\D/g, "");
  const normalizedPhone = digits ? `+${digits}` : null;
  const client = normalizedPhone ? await fetchClientByPhone(normalizedPhone) : null;

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();
  const orderItems: OrderItem[] = bodyItems.map((item) => ({
    id: crypto.randomUUID(),
    category: productMap.get(item.product_id)?.category?.name ?? null,
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    unit: item.unit,
    qty: item.qty,
    price: item.price,
    total_amount: item.total_amount,
  }));

  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    source: "admin",
    company_name: companyName,
    customer_bin: profile.customerBin || null,
    customer_name: profile.customerName ?? companyName,
    customer_phone: normalizedPhone ?? phone,
    customer_email: profile.customerEmail || null,
    delivery_address: profile.deliveryAddress || null,
    delivery_date: deliveryDate || null,
    delivery_time: deliveryTime || null,
    payment_method: paymentMethod,
    request_avr: requestAvr,
    // Атрибуция v1: кто оформил — первой строкой комментария (видно админу).
    comment: [`Оформил (торгпред): ${actorEmail}`, comment || null].filter(Boolean).join("\n"),
    client_id: client?.id ?? null,
    status: "pending_manager_confirmation",
    total_amount: totalAmount,
    delivery_amount: deliveryFee(totalAmount),
    payment_status: "unpaid",
    oferta_accepted_at: new Date().toISOString(),
    oferta_version: OFERTA_VERSION,
    created_at: new Date().toISOString(),
  };

  try {
    await insertOrderWithItems(order, orderItems);
  } catch (error) {
    reportError(error, { where: "admin:orders:insert", extra: { orderNumber } });
    return NextResponse.json({ error: "Не удалось сохранить заказ" }, { status: 500 });
  }

  // Списываем остатки (как в клиентском флоу) — best-effort, заказ не рушим.
  try {
    for (const item of orderItems) {
      const current = Number(productMap.get(item.product_id)?.stock_qty ?? 0);
      await decrementProductStock(item.product_id, item.qty, current);
    }
    revalidateTag(CATALOG_CACHE_TAG, "max");
  } catch (error) {
    reportError(error, { where: "admin:orders:stock", extra: { orderNumber } });
  }

  // Уведомляем команду (best-effort) — заявка встаёт в очередь на подтверждение админом.
  await Promise.all([
    sendWhatsAppNotification(order, orderItems).catch(() => null),
    sendTelegramNotification(order, orderItems).catch(() => null),
  ]);

  return NextResponse.json({ orderId, orderNumber });
}
