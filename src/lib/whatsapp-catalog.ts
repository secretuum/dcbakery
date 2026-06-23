import "server-only";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
import { formatPrice } from "@/src/lib/format";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import {
  insertOrderWithItems,
  updateOrderTelegramMessageId,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import { sendTelegramNotification } from "@/src/lib/telegram";
import { sendGreenApiTextMessage, sendWhatsAppNotification } from "@/src/lib/whatsapp";
import type { Order, OrderItem, Product } from "@/src/types";

type CustomerMessageInput = {
  chatId: string;
  senderName?: string;
  text: string;
};

type ParsedOrderItem = {
  product: Product;
  qty: number;
};

const categoryAliases: Record<string, string> = {
  deserty: "deserty",
  десерт: "deserty",
  десерты: "deserty",
  myaso: "myaso",
  мясо: "myaso",
  polufabrikaty: "polufabrikaty",
  полуфабрикат: "polufabrikaty",
  полуфабрикаты: "polufabrikaty",
  semi: "polufabrikaty",
};

function optional(value?: string | null) {
  return value?.trim() ? value.trim() : null;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  return `DCB-${year}-${suffix}`;
}

function getPhoneFromChatId(chatId: string) {
  const digits = chatId.split("@")[0]?.replace(/\D/g, "") ?? "";

  return digits ? `+${digits}` : chatId;
}

function formatProductPrice(product: Product) {
  return product.price > 0 ? formatPrice(product.price) : "Цена уточняется";
}

function formatProductLine(product: Product) {
  const weight = product.weightLabel ? `, ${product.weightLabel}` : "";

  return `- ${product.slug}: ${product.name}${weight} — ${formatProductPrice(product)}`;
}

async function formatCatalogIntro() {
  const categories = await fetchCategories();
  const categoryLines = categories.map((category) => `- ${category.name}: ${category.slug}`);

  return [
    "*DC Bakery B2B каталог*",
    "",
    "Напишите категорию, чтобы получить товары:",
    ...categoryLines,
    "",
    "Команды:",
    "каталог — показать категории",
    "товар slug — карточка товара",
    "заказ slug 10 — оформить заявку",
    "менеджер — позвать менеджера",
    "",
    "Пример:",
    "заказ napoleon 19",
  ].join("\n");
}

function formatCategoryMessage(categoryName: string, products: Product[]) {
  const visibleProducts = products.slice(0, 12);
  const hiddenCount = Math.max(0, products.length - visibleProducts.length);

  return [
    `*${categoryName}*`,
    "",
    ...visibleProducts.map(formatProductLine),
    hiddenCount > 0 ? `\nЕще ${hiddenCount} позиций есть на сайте.` : null,
    "",
    "Чтобы оформить заявку:",
    "заказ slug количество",
    "",
    "Например:",
    visibleProducts[0] ? `заказ ${visibleProducts[0].slug} 10` : "заказ napoleon 10",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatProductDetails(product: Product) {
  return [
    `*${product.name}*`,
    "",
    `Код: ${product.slug}`,
    `Категория: ${product.category?.name ?? "не указано"}`,
    product.weightLabel ? `Вес: ${product.weightLabel}` : null,
    `Цена: ${formatProductPrice(product)}`,
    `Остаток: ${product.stock_qty} ${product.unit}`,
    product.shelfLife ? `Срок годности: ${product.shelfLife}` : null,
    product.storage ? `Хранение: ${product.storage}` : null,
    "",
    product.description,
    "",
    `Заказать: заказ ${product.slug} 10`,
  ]
    .filter(Boolean)
    .join("\n");
}

function readField(text: string, labels: string[]) {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:=-]\\s*(.+)`, "i");
  const match = text.match(pattern);

  return optional(match?.[1]?.split("\n")[0]);
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const isoMatch = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);

  if (isoMatch) {
    return isoMatch[0];
  }

  const dottedMatch = value.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);

  if (!dottedMatch) {
    return null;
  }

  const [, day, month, year] = dottedMatch;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseOrderItems(text: string, products: Product[]) {
  const normalizedText = normalizeText(text);
  const segments = normalizedText
    .replace(/^(заказ|заказать|order)\b/u, "")
    .split(/[\n,;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const parsedItems: ParsedOrderItem[] = [];

  for (const segment of segments) {
    const product = products.find((candidate) => {
      const slugPattern = new RegExp(`(^|\\s)${escapeRegExp(candidate.slug)}($|\\s)`, "u");
      const idPattern = new RegExp(`(^|\\s)${escapeRegExp(candidate.id)}($|\\s)`, "u");

      return slugPattern.test(segment) || idPattern.test(segment);
    });

    if (!product) {
      continue;
    }

    const qtyMatch = segment.match(/(?:x|х|\*)?\s*(\d+(?:[.,]\d+)?)/u);
    const qty = qtyMatch ? Number(qtyMatch[1].replace(",", ".")) : 1;

    if (Number.isFinite(qty) && qty > 0) {
      parsedItems.push({ product, qty });
    }
  }

  return parsedItems;
}

function formatOrderSyntaxError(products: Product[]) {
  const exampleProduct = products[0];

  return [
    "*Не понял заказ*",
    "",
    "Напишите так:",
    `заказ ${exampleProduct?.slug ?? "napoleon"} 10`,
    "",
    "Можно несколько позиций:",
    `заказ ${exampleProduct?.slug ?? "napoleon"} 10, ${products[1]?.slug ?? "eclair"} 5`,
    "",
    "Чтобы посмотреть товары, напишите: каталог",
    "Чтобы позвать человека, напишите: менеджер",
  ].join("\n");
}

function formatMinimumOrderMessage(totalAmount: number) {
  const left = MIN_ORDER_AMOUNT - totalAmount;

  return [
    "*Минимальный заказ еще не набран*",
    "",
    `Сейчас: ${formatPrice(totalAmount)}`,
    `Минимум: ${formatPrice(MIN_ORDER_AMOUNT)}`,
    `Добавить еще: ${formatPrice(left)}`,
    "",
    "Можно добавить еще позиции или написать: менеджер",
  ].join("\n");
}

async function createWhatsAppOrder({
  chatId,
  items,
  senderName,
  text,
}: {
  chatId: string;
  items: ParsedOrderItem[];
  senderName?: string;
  text: string;
}) {
  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();
  const customerPhone = getPhoneFromChatId(chatId);
  const companyName = readField(text, ["компания", "заведение", "company"]) ?? "WhatsApp клиент";
  const customerName =
    readField(text, ["имя", "контакт", "name"]) ?? optional(senderName) ?? "WhatsApp клиент";
  const deliveryDate = parseDate(readField(text, ["дата", "delivery_date"])) ?? getTomorrowDate();
  const deliveryAddress = readField(text, ["адрес", "address"]);
  const paymentMethod = readField(text, ["оплата", "payment"]) ?? "Договориться с менеджером";
  const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const orderItems: OrderItem[] = items.map(({ product, qty }) => ({
    category: product.category?.name ?? null,
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: product.id,
    product_name: product.name,
    unit: product.unit,
    qty,
    price: product.price,
    total_amount: product.price * qty,
  }));
  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    source: "whatsapp",
    company_name: companyName,
    customer_bin: null,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: null,
    delivery_address: deliveryAddress,
    delivery_date: deliveryDate,
    delivery_time: "Договориться с менеджером",
    payment_method: paymentMethod,
    comment: `Заявка из WhatsApp. Чат клиента: ${chatId}`,
    status: "pending_manager_confirmation",
    total_amount: totalAmount,
    payment_status: "unpaid",
    created_at: new Date().toISOString(),
  };

  await insertOrderWithItems(order, orderItems);

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

  return { order, orderItems, telegramMessageId, whatsappMessageId };
}

function formatCustomerOrderSuccess(order: Order, items: OrderItem[]) {
  const itemLines = items.map((item) => `- ${item.product_name} x ${item.qty} ${item.unit}`);

  return [
    `*Заявка ${order.order_number} принята*`,
    "",
    "Менеджер проверит остатки и подтвердит заказ.",
    "",
    ...itemLines,
    "",
    `Предварительная сумма: ${formatPrice(order.total_amount)}`,
    "",
    "Для уточнений напишите: менеджер",
  ].join("\n");
}

async function notifyManagerRequested(chatId: string, senderName: string | undefined, text: string) {
  const managerChatId = process.env.GREEN_API_CHAT_ID;

  if (!managerChatId) {
    return null;
  }

  return sendGreenApiTextMessage(
    managerChatId,
    [
      "*Клиент просит менеджера в WhatsApp*",
      "",
      `Имя: ${optional(senderName) ?? "не указано"}`,
      `Телефон: ${getPhoneFromChatId(chatId)}`,
      `Чат: ${chatId}`,
      "",
      text ? `Сообщение: ${text}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function isCustomerWhatsAppChat(chatId: string) {
  return chatId.endsWith("@c.us");
}

export async function handleWhatsAppCustomerMessage({
  chatId,
  senderName,
  text,
}: CustomerMessageInput) {
  const normalizedText = normalizeText(text);
  const products = await fetchProducts();

  if (
    !normalizedText ||
    normalizedText === "start" ||
    normalizedText === "меню" ||
    normalizedText === "каталог" ||
    normalizedText === "catalog"
  ) {
    const message = await formatCatalogIntro();
    const messageId = await sendGreenApiTextMessage(chatId, message);

    return { action: "catalog", messageId, ok: true };
  }

  if (normalizedText.includes("менеджер") || normalizedText.includes("manager")) {
    const managerMessageId = await notifyManagerRequested(chatId, senderName, text);
    const messageId = await sendGreenApiTextMessage(
      chatId,
      "Менеджера позвали. Он подключится к диалогу или свяжется с вами отдельно.",
    );

    return { action: "manager_requested", managerMessageId, messageId, ok: true };
  }

  const categorySlug = categoryAliases[normalizedText];

  if (categorySlug) {
    const categoryProducts = products.filter((product) => product.category?.slug === categorySlug);
    const categoryName = categoryProducts[0]?.category?.name ?? normalizedText;
    const message = formatCategoryMessage(categoryName, categoryProducts);
    const messageId = await sendGreenApiTextMessage(chatId, message);

    return { action: "category", messageId, ok: true };
  }

  const productSlug = normalizedText.replace(/^товар\s+/u, "").trim();
  const product = products.find(
    (candidate) => candidate.slug === productSlug || candidate.id === productSlug,
  );

  if (product) {
    const messageId = await sendGreenApiTextMessage(chatId, formatProductDetails(product));

    return { action: "product", messageId, ok: true };
  }

  if (/^(заказ|заказать|order)\b/u.test(normalizedText)) {
    const items = parseOrderItems(text, products);

    if (items.length === 0) {
      const messageId = await sendGreenApiTextMessage(chatId, formatOrderSyntaxError(products));

      return { action: "order_error", messageId, ok: false, reason: "No items" };
    }

    const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const hasUnknownPrice = items.some((item) => item.product.price <= 0);

    if (!hasUnknownPrice && totalAmount < MIN_ORDER_AMOUNT) {
      const messageId = await sendGreenApiTextMessage(chatId, formatMinimumOrderMessage(totalAmount));

      return { action: "order_error", messageId, ok: false, reason: "Minimum order" };
    }

    const { order, orderItems, telegramMessageId, whatsappMessageId } = await createWhatsAppOrder({
      chatId,
      items,
      senderName,
      text,
    });
    const messageId = await sendGreenApiTextMessage(
      chatId,
      formatCustomerOrderSuccess(order, orderItems),
    );

    return {
      action: "order_created",
      messageId,
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      telegramMessageId,
      whatsappMessageId,
    };
  }

  const messageId = await sendGreenApiTextMessage(
    chatId,
    [
      "Я пока понимаю команды:",
      "каталог",
      "десерты / полуфабрикаты / мясо",
      "товар slug",
      "заказ slug количество",
      "менеджер",
    ].join("\n"),
  );

  return { action: "unknown", messageId, ok: true };
}
