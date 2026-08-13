import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { deliveryFee } from "@/app/constants";
import { CATALOG_CACHE_TAG, fetchProducts } from "@/src/lib/catalog";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";
import { resolveCartItems, validateOrderFields } from "@/src/lib/orders/order-validation";
import { getSiteContent } from "@/src/lib/site-content";
import {
  fetchClientByEmail,
  fetchClientByPhone,
  getSupabaseAdminConfigError,
  insertOrderWithItems,
  updateOrderTelegramMessageId,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { decrementProductStock } from "@/src/lib/orders/stock";
import { sendOrderConfirmationEmail } from "@/src/lib/orders/order-email";
import { canPlaceOrder } from "@/src/lib/credit";
import { getAccountTier, isOverLiteCap, LITE_ORDER_CAP } from "@/src/lib/account/tier";
import { reportError } from "@/src/lib/monitoring";
import { sendTelegramNotification } from "@/src/lib/telegram";
import {
  getWhatsAppChatIdFromPhone,
  sendWhatsAppNotification,
} from "@/src/lib/whatsapp";
import {
  fetchWhatsAppClientByChatId,
  mergeClientAddressList,
  saveWhatsAppClientProfile,
} from "@/src/lib/whatsapp-client-store";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { updateOrderCustomerType } from "@/src/lib/supabase/admin";
import type { CustomerType, Order } from "@/src/types";

const CUSTOMER_TYPES: readonly CustomerType[] = ["legal", "ip", "individual"];

function asCustomerType(value: unknown): CustomerType | null {
  return typeof value === "string" && CUSTOMER_TYPES.includes(value as CustomerType)
    ? (value as CustomerType)
    : null;
}

const OFERTA_VERSION = "2026-07-14";

type IncomingItem = {
  price?: number;
  product_id: string;
  product_name?: string;
  qty: number;
  total_amount?: number;
  unit?: string;
};

type IncomingOrderBody = {
  comment?: string;
  customer_bin?: string;
  customer_type?: CustomerType | null;
  company_name?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  delivery_date?: string;
  delivery_time?: string;
  items?: IncomingItem[];
  payment_method?: string;
  request_avr?: boolean;
  oferta_accepted?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue.toLowerCase();

  return normalizedValue === "null" || normalizedValue === "undefined" ? "" : trimmedValue;
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
  // 6 цифр ms повторяются каждые ~16 мин → при UNIQUE(order_number) заказ мог не
  // сохраниться. Добавляем 4 случайных hex-символа (пространство ×65536), чтобы
  // совпадение стало практически невозможным.
  const rand = crypto.randomUUID().slice(0, 4);
  return `DCB-${year}-${suffix}-${rand}`;
}

function parseItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item): IncomingItem => {
      const qty = asPositiveNumber(item.qty);

      return {
        product_id: asString(item.product_id),
        qty,
      };
    })
    .filter((item) => item.product_id && item.qty > 0);
}

function parseBody(value: unknown): IncomingOrderBody {
  if (!isRecord(value)) {
    return {};
  }

  return {
    comment: asString(value.comment),
    company_name: asString(value.company_name),
    customer_bin: asString(value.customer_bin),
    customer_type: asCustomerType(value.customer_type),
    customer_email: asString(value.customer_email),
    customer_name: asString(value.customer_name),
    customer_phone: asString(value.customer_phone),
    delivery_address: asString(value.delivery_address),
    delivery_date: asString(value.delivery_date),
    delivery_time: asString(value.delivery_time),
    items: parseItems(value.items),
    payment_method: asString(value.payment_method),
    request_avr: value.request_avr === true,
    oferta_accepted: value.oferta_accepted === true,
  };
}

// Валидация вынесена в чистый модуль order-validation (покрыта тестами) — делегируем.
function validateOrder(body: IncomingOrderBody, deliveryDays: number[]) {
  return validateOrderFields(body, deliveryDays, getTomorrowDate());
}

async function resolveItemsFromServer(items: IncomingItem[]) {
  const products = await fetchProducts();
  return resolveCartItems(items, products);
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 10,
    namespace: "orders:create",
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many order attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const supabaseConfigError = getSupabaseAdminConfigError();

  if (supabaseConfigError) {
    return NextResponse.json({ error: supabaseConfigError }, { status: 503 });
  }

  // Серверная проверка сессии: заказ может создать только авторизованный клиент.
  // Раньше требование аккаунта было только на фронте (CheckoutAuthGate) — прямой POST
  // его обходил. Килл-свитч ORDERS_REQUIRE_SESSION=false отключает enforce на случай сбоя.
  const requireSession = process.env.ORDERS_REQUIRE_SESSION !== "false";
  const sessionCookie = (await cookies()).get(CLIENT_SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifyClientSession(sessionCookie) : null;
  if (requireSession && !session) {
    return NextResponse.json({ error: "Требуется вход в аккаунт" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = parseBody(payload);
  const { errors: itemErrors, productMap, resolvedItems } = await resolveItemsFromServer(
    parsedBody.items ?? [],
  );
  const body = {
    ...parsedBody,
    items: resolvedItems.map((item) => {
      const product = productMap.get(item.product_id);

      return {
        product_id: item.product_id,
        qty: item.qty,
        price: product?.price ?? 0,
        product_name: product?.name ?? item.product_id,
        total_amount: (product?.price ?? 0) * item.qty,
        unit: product?.unit ?? "шт",
      };
    }),
  };
  // График доставки берём из настроек (тот же источник, что и клиентский календарь).
  const siteContent = await getSiteContent().catch(() => null);
  const deliveryDays = siteContent?.deliveryDays ?? [2, 4, 6];
  const { errors, totalAmount } = validateOrder(body, deliveryDays);
  errors.push(...itemErrors);

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const normalizedPhone = body.customer_phone?.replace(/\D/g, "")
    ? `+${body.customer_phone.replace(/\D/g, "")}`
    : null;

  // R1: личность для кредита/тира/потолка берём из СЕССИИ, не из тела запроса — иначе
  // контроль обходится подстановкой чужого/пустого телефона. Тело не должно противоречить сессии.
  const sessionPhone = session?.phone ? `+${session.phone.replace(/\D/g, "")}` : null;
  const sessionEmail = session?.email?.trim().toLowerCase() || null;
  if (session) {
    const bodyEmail = body.customer_email?.trim().toLowerCase() || null;
    // Тело с телефоном допустимо ТОЛЬКО если он совпадает с телефоном сессии.
    // Иначе (в т.ч. когда у сессии телефона нет — вход по email) тело-телефон
    // мог бы подставить чужого клиента → отвергаем, чтобы личность решала только сессия.
    if (
      (normalizedPhone && normalizedPhone !== sessionPhone) ||
      (bodyEmail && sessionEmail && bodyEmail !== sessionEmail)
    ) {
      return NextResponse.json(
        { error: "Данные заказа не совпадают с аккаунтом. Обновите страницу и войдите заново." },
        { status: 403 },
      );
    }
  }

  // При наличии сессии телефон для поиска клиента — СТРОГО из сессии (без отката на
  // тело). Нет телефона в сессии (вход по email) → клиент ищется только по email ниже.
  const lookupPhone = session ? sessionPhone : normalizedPhone;
  const lookupEmail = sessionEmail ?? (body.customer_email?.trim().toLowerCase() || null);
  const client = lookupPhone
    ? await fetchClientByPhone(lookupPhone)
    : lookupEmail
      ? await fetchClientByEmail(lookupEmail)
      : null;

  const orderSum = totalAmount + deliveryFee(totalAmount);

  // Потолок суммы для облегчённого (lite) аккаунта. Тир — по профилю (БИН+адрес) и
  // кредиту клиента; личность взята из сессии (см. выше).
  const chatId = lookupPhone ? getWhatsAppChatIdFromPhone(lookupPhone) : null;
  const profile = chatId ? await fetchWhatsAppClientByChatId(chatId).catch(() => null) : null;
  const tier = getAccountTier({
    customerBin: profile?.customerBin,
    hasAddress: Boolean(profile?.deliveryAddress || (profile?.addresses?.length ?? 0) > 0),
    creditLimit: client?.credit_limit ?? 0,
  });
  if (isOverLiteCap(tier, orderSum)) {
    return NextResponse.json(
      { errors: [`Для облегчённого аккаунта лимит заказа ${LITE_ORDER_CAP} ₸. Укажите БИН и адрес доставки, чтобы снять потолок.`] },
      { status: 409 },
    );
  }

  let requiresPrepay = false;
  let prepayReason: string | null = null;
  if (client) {
    const creditCheck = await canPlaceOrder(client, orderSum);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { errors: [creditCheck.reason ?? "Заказ не может быть принят"] },
        { status: 409 },
      );
    }
    // allowed:true + requiresPrepay:true — клиент с отсрочкой (credit_limit>0), временно
    // превысивший лимит или с просрочкой в пределах grace. Раньше флаг МОЛЧА игнорировался
    // → заказ уходил в обычную консигнацию, и превышение лимита не всплывало. Жёсткого
    // стопа тут не ставим (шлюз отгрузки shipmentBlockedForPrepay намеренно ключует на
    // статичный credit_limit во избежание циркулярности) — вместо этого явно помечаем заказ
    // для менеджера и возвращаем флаг клиенту.
    if (creditCheck.requiresPrepay) {
      requiresPrepay = true;
      prepayReason = creditCheck.reason ?? "превышен лимит или есть просрочка";
    }
  }

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();
  const orderItems = (body.items ?? []).map((item) => ({
    id: crypto.randomUUID(),
    category: productMap.get(item.product_id)?.category?.name ?? null,
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name ?? item.product_id,
    unit: item.unit ?? "шт",
    qty: item.qty,
    price: item.price ?? 0,
    total_amount: item.total_amount ?? (item.price ?? 0) * item.qty,
  }));
  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    source: "website",
    company_name: body.company_name ?? "",
    customer_bin: body.customer_bin || null,
    customer_type: body.customer_type ?? null,
    customer_name: body.customer_name ?? "",
    // Храним номер в нормализованном виде (+7XXXXXXXXXX) — чтобы кабинет находил
    // заказ по телефону, а не по человекочитаемой строке с пробелами/скобками.
    customer_phone: normalizedPhone ?? body.customer_phone ?? "",
    customer_email: body.customer_email || null,
    delivery_address: body.delivery_address || null,
    delivery_date: body.delivery_date || null,
    delivery_time: body.delivery_time || null,
    payment_method: body.payment_method || null,
    request_avr: body.request_avr === true,
    comment:
      [
        requiresPrepay
          ? `⚠️ Требуется предоплата (${prepayReason}). Не отгружать в консигнацию до оплаты.`
          : null,
        body.comment || null,
      ]
        .filter(Boolean)
        .join("\n") || null,
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
    // Раньше ошибка проглатывалась молча — теперь логируем и репортим в мониторинг
    // (поведение ответа не меняется: тот же 500).
    reportError(error, { where: "orders:insert", extra: { orderNumber: order.order_number } });
    return NextResponse.json(
      {
        error: "Failed to save order",
      },
      { status: 500 },
    );
  }

  // Тип клиента (customer_type) — ОТДЕЛЬНЫМ best-effort апдейтом, а не в основной вставке.
  // Так деплой кода ДО применения миграции (колонки ещё нет) не ломает создание заказа:
  // апдейт тихо не удастся, заказ уже сохранён. После миграции колонка заполняется штатно.
  if (order.customer_type) {
    await updateOrderCustomerType(orderId, order.customer_type).catch(() => {});
  }

  // Списываем остаток по каждой позиции АТОМАРНО через RPC decrement_product_stock
  // (миграция 202608030001) — конец гонке/двойному списанию. fallback = эффективный
  // остаток из приложения (для товара без оверрайд-строки). Best-effort: не роняем заказ.
  try {
    let oversold = false;
    for (const item of orderItems) {
      const current = Number(productMap.get(item.product_id)?.stock_qty ?? 0);
      const applied = await decrementProductStock(item.product_id, item.qty, current);
      if (!applied) oversold = true;
    }
    revalidateTag(CATALOG_CACHE_TAG, "max");
    if (oversold) {
      // Условный RPC не списал хотя бы по одной позиции ⇒ остатка не хватило: заказ
      // прошёл валидацию по устаревшему кэш-остатку, а фактически товар уже разобран
      // (гонка одновременных заказов). Заказ создан (его подтверждает менеджер) — не
      // рушим, но АЛЕРТИМ, чтобы поймать пересорт вручную.
      reportError(new Error(`stock oversell race on order ${orderNumber}`), {
        where: "orders:stock-oversell",
        extra: { orderNumber },
      });
    }
  } catch (error) {
    reportError(error, { where: "orders:stock-decrement", extra: { orderNumber } });
  }

  // Письмо-подтверждение клиенту (best-effort; только при заданном RESEND_API_KEY и email).
  await sendOrderConfirmationEmail(order, orderItems).catch(() => {});

  const customerChatId = getWhatsAppChatIdFromPhone(order.customer_phone);

  if (customerChatId) {
    await saveWhatsAppClientProfile({
      chatId: customerChatId,
      companyName: order.company_name,
      customerBin: order.customer_bin,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      deliveryAddress: order.delivery_address,
      deliveryDate: order.delivery_date,
      deliveryTime: order.delivery_time,
      paymentMethod: order.payment_method,
      addresses: mergeClientAddressList([], order.delivery_address),
      lastOrderId: order.id,
    }).catch((error) => {
      console.warn("[orders] Failed to save customer profile:", error);
    });
  }

  const [whatsappMessageId, telegramMessageId] = await Promise.all([
    sendWhatsAppNotification(order, orderItems).catch(() => null),
    sendTelegramNotification(order, orderItems)
      .then((messageId) => (messageId ? String(messageId) : null))
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

  return NextResponse.json({
    orderId,
    orderNumber,
    whatsappMessageId,
    telegramMessageId,
    requiresPrepay,
  });
}
