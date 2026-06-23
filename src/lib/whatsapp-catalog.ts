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
import {
  clearWhatsAppCart,
  fetchWhatsAppCart,
  saveWhatsAppCart,
  type WhatsAppCart,
  type WhatsAppCartItem,
} from "@/src/lib/whatsapp-cart-store";
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

type CustomerSession =
  | {
      mode: "catalog";
      categorySlugs: string[];
    }
  | {
      categorySlug: string;
      mode: "category";
      productSlugs: string[];
    }
  | {
      categorySlug?: string;
      mode: "product";
      productSlug: string;
      productSlugs?: string[];
    };

const MAX_CATEGORY_PRODUCTS = 12;
const customerSessions = new Map<string, CustomerSession>();
const fallbackCarts = new Map<string, WhatsAppCart>();

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

function formatProductLine(product: Product, index?: number) {
  const weight = product.weightLabel ? `, ${product.weightLabel}` : "";
  const prefix = typeof index === "number" ? `${index + 1}. ` : "- ";

  return `${prefix}${product.slug}: ${product.name}${weight} — ${formatProductPrice(product)}`;
}

function parseStrictPositiveNumber(value: string) {
  const normalizedValue = value.replace(",", ".").trim();
  const number = Number(normalizedValue);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseNumberOnlyCommand(value: string) {
  const match = value.match(/^\d+$/);

  return match ? Number(match[0]) : null;
}

function getProductBySlug(products: Product[], slug?: string) {
  return slug ? products.find((product) => product.slug === slug || product.id === slug) ?? null : null;
}

function getFallbackCart(chatId: string) {
  return fallbackCarts.get(chatId) ?? { chatId, items: [] };
}

async function loadCart(chatId: string) {
  try {
    return await fetchWhatsAppCart(chatId);
  } catch (error) {
    console.warn("[whatsapp:cart] Using in-memory cart fallback:", error);
    return getFallbackCart(chatId);
  }
}

async function persistCart(cart: WhatsAppCart) {
  fallbackCarts.set(cart.chatId, cart);

  try {
    return await saveWhatsAppCart(cart);
  } catch (error) {
    console.warn("[whatsapp:cart] Failed to persist cart, kept in memory:", error);
    return cart;
  }
}

async function removeCart(chatId: string) {
  fallbackCarts.delete(chatId);

  try {
    await clearWhatsAppCart(chatId);
  } catch (error) {
    console.warn("[whatsapp:cart] Failed to clear persisted cart:", error);
  }
}

function findSessionProductByNumber(
  session: CustomerSession | undefined,
  products: Product[],
  optionNumber: number,
) {
  if (session?.mode !== "category" || optionNumber < 1) {
    return null;
  }

  return getProductBySlug(products, session.productSlugs[optionNumber - 1]);
}

function formatCatalogIntro(categories: Awaited<ReturnType<typeof fetchCategories>>) {
  const categoryLines = categories.map((category, index) => `${index + 1}. ${category.name}`);

  return [
    "*DC Bakery B2B каталог*",
    "",
    "Выберите категорию цифрой или напишите название:",
    ...categoryLines,
    "",
    "0. Позвать менеджера",
    "",
    "Команды:",
    "1 / 2 / 3 — открыть категорию",
    "товар slug — карточка товара",
    "заказ slug 10 — добавить в корзину",
    "корзина — посмотреть корзину",
    "оформить — отправить заявку",
    "менеджер — позвать менеджера",
    "",
    "Пример:",
    "заказ napoleon 10",
  ].join("\n");
}

function formatCategoryMessage(categoryName: string, products: Product[]) {
  const visibleProducts = products.slice(0, MAX_CATEGORY_PRODUCTS);
  const hiddenCount = Math.max(0, products.length - visibleProducts.length);

  return [
    `*${categoryName}*`,
    "",
    ...visibleProducts.map(formatProductLine),
    hiddenCount > 0 ? `\nЕще ${hiddenCount} позиций есть на сайте.` : null,
    "",
    "Что дальше:",
    "1 / 2 / 3 — открыть товар",
    "заказ 1 10 — добавить товар №1 в корзину",
    "0 — назад в каталог",
    "",
    "Например:",
    visibleProducts[0] ? "заказ 1 10" : "каталог",
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
    "Чтобы добавить в корзину, напишите количество цифрой, например:",
    "10",
    "",
    `Или командой: заказ ${product.slug} 10`,
    "0 — назад к списку",
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

function resolveProductFromOrderSegment(
  segment: string,
  products: Product[],
  session?: CustomerSession,
) {
  const productBySlug = products.find((candidate) => {
    const slugPattern = new RegExp(`(^|\\s)${escapeRegExp(candidate.slug)}($|\\s)`, "u");
    const idPattern = new RegExp(`(^|\\s)${escapeRegExp(candidate.id)}($|\\s)`, "u");

    return slugPattern.test(segment) || idPattern.test(segment);
  });

  if (productBySlug) {
    return productBySlug;
  }

  const optionMatch = segment.match(/^\s*(\d+)(?:\s|$)/);

  if (optionMatch) {
    return findSessionProductByNumber(session, products, Number(optionMatch[1]));
  }

  if (session?.mode === "product") {
    return getProductBySlug(products, session.productSlug);
  }

  return null;
}

function resolveQtyFromOrderSegment(segment: string, hasNumericProductReference: boolean) {
  const matches = Array.from(segment.matchAll(/\d+(?:[.,]\d+)?/g));
  const qtyMatch = hasNumericProductReference ? matches[1] : matches[0];
  const qty = qtyMatch ? Number(qtyMatch[0].replace(",", ".")) : 1;

  return Number.isFinite(qty) && qty > 0 ? qty : null;
}

function parseOrderItems(text: string, products: Product[], session?: CustomerSession) {
  const normalizedText = normalizeText(text);
  const segments = normalizedText
    .replace(/^(заказ|заказать|order)\b/u, "")
    .split(/[\n,;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const parsedItems: ParsedOrderItem[] = [];

  for (const segment of segments) {
    const product = resolveProductFromOrderSegment(segment, products, session);

    if (!product) {
      continue;
    }

    const hasNumericProductReference =
      session?.mode === "category" && Boolean(segment.match(/^\s*\d+(?:\s|$)/));
    const qty = resolveQtyFromOrderSegment(segment, hasNumericProductReference);

    if (qty) {
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

function resolveCartItems(cartItems: WhatsAppCartItem[], products: Product[]): ParsedOrderItem[] {
  return cartItems.flatMap((item) => {
    const product = getProductBySlug(products, item.productId);

    return product ? [{ product, qty: item.qty }] : [];
  });
}

function getCartTotal(items: ParsedOrderItem[]) {
  return items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
}

function formatCartMessage(cartItems: ParsedOrderItem[]) {
  if (cartItems.length === 0) {
    return [
      "*Корзина пустая*",
      "",
      "Напишите каталог, выберите товар и укажите количество.",
    ].join("\n");
  }

  const itemLines = cartItems.map(({ product, qty }, index) => {
    const total = product.price > 0 ? formatPrice(product.price * qty) : "Цена уточняется";

    return `${index + 1}. ${product.name} x ${qty} ${product.unit} = ${total}`;
  });
  const totalAmount = getCartTotal(cartItems);
  const hasUnknownPrice = cartItems.some((item) => item.product.price <= 0);

  return [
    "*Ваша корзина*",
    "",
    ...itemLines,
    "",
    `Итого: ${hasUnknownPrice ? "часть цен уточняется" : formatPrice(totalAmount)}`,
    !hasUnknownPrice && totalAmount < MIN_ORDER_AMOUNT
      ? `До минимума ${formatPrice(MIN_ORDER_AMOUNT)} осталось ${formatPrice(MIN_ORDER_AMOUNT - totalAmount)}`
      : null,
    "",
    "Команды:",
    "оформить — отправить заявку",
    "очистить — очистить корзину",
    "каталог — добавить еще товары",
  ]
    .filter(Boolean)
    .join("\n");
}

function mergeCartItems(currentItems: WhatsAppCartItem[], nextItems: ParsedOrderItem[]) {
  const nextItemMap = new Map(currentItems.map((item) => [item.productId, item.qty]));

  for (const item of nextItems) {
    nextItemMap.set(item.product.id, (nextItemMap.get(item.product.id) ?? 0) + item.qty);
  }

  return Array.from(nextItemMap.entries())
    .map(([productId, qty]) => ({ productId, qty }))
    .filter((item) => item.qty > 0);
}

async function addItemsToCart({
  chatId,
  items,
  products,
  senderName,
}: {
  chatId: string;
  items: ParsedOrderItem[];
  products: Product[];
  senderName?: string;
}) {
  const cart = await loadCart(chatId);
  const savedCart = await persistCart({
    chatId,
    customerPhone: getPhoneFromChatId(chatId),
    items: mergeCartItems(cart.items, items),
    senderName: optional(senderName) ?? cart.senderName ?? null,
  });
  const resolvedItems = resolveCartItems(savedCart.items, products);
  const messageId = await sendGreenApiTextMessage(
    chatId,
    [
      "*Добавлено в корзину*",
      "",
      ...items.map((item) => `- ${item.product.name} x ${item.qty} ${item.product.unit}`),
      "",
      formatCartMessage(resolvedItems),
    ].join("\n"),
  );

  return { action: "cart_updated", messageId, ok: true };
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

async function submitCustomerOrder({
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
  const categories = await fetchCategories();
  const products = await fetchProducts();
  const session = customerSessions.get(chatId);

  async function sendCatalog() {
    customerSessions.set(chatId, {
      categorySlugs: categories.map((category) => category.slug),
      mode: "catalog",
    });

    const messageId = await sendGreenApiTextMessage(chatId, formatCatalogIntro(categories));

    return { action: "catalog", messageId, ok: true };
  }

  async function sendCategory(categorySlug: string) {
    const categoryProducts = products
      .filter((product) => product.category?.slug === categorySlug)
      .slice(0, MAX_CATEGORY_PRODUCTS);
    const categoryName = categoryProducts[0]?.category?.name ?? categorySlug;

    customerSessions.set(chatId, {
      categorySlug,
      mode: "category",
      productSlugs: categoryProducts.map((product) => product.slug),
    });

    const messageId = await sendGreenApiTextMessage(
      chatId,
      formatCategoryMessage(categoryName, categoryProducts),
    );

    return { action: "category", messageId, ok: true };
  }

  async function sendProduct(product: Product, productSlugs?: string[]) {
    customerSessions.set(chatId, {
      categorySlug: product.category?.slug,
      mode: "product",
      productSlug: product.slug,
      productSlugs,
    });

    const messageId = await sendGreenApiTextMessage(chatId, formatProductDetails(product));

    return { action: "product", messageId, ok: true };
  }

  if (
    !normalizedText ||
    normalizedText === "start" ||
    normalizedText === "меню" ||
    normalizedText === "каталог" ||
    normalizedText === "catalog"
  ) {
    return sendCatalog();
  }

  if (normalizedText === "назад" || normalizedText === "back") {
    if (session?.mode === "product" && session.categorySlug) {
      return sendCategory(session.categorySlug);
    }

    return sendCatalog();
  }

  if (normalizedText === "корзина" || normalizedText === "cart") {
    const cart = await loadCart(chatId);
    const messageId = await sendGreenApiTextMessage(
      chatId,
      formatCartMessage(resolveCartItems(cart.items, products)),
    );

    return { action: "cart", messageId, ok: true };
  }

  if (normalizedText === "очистить" || normalizedText === "clear") {
    await removeCart(chatId);
    const messageId = await sendGreenApiTextMessage(
      chatId,
      "Корзину очистил. Чтобы выбрать товары заново, напишите: каталог",
    );

    return { action: "cart_cleared", messageId, ok: true };
  }

  if (
    normalizedText === "оформить" ||
    normalizedText === "checkout" ||
    normalizedText === "отправить"
  ) {
    const cart = await loadCart(chatId);
    const items = resolveCartItems(cart.items, products);

    if (items.length === 0) {
      const messageId = await sendGreenApiTextMessage(chatId, formatCartMessage([]));

      return { action: "cart_empty", messageId, ok: false };
    }

    const result = await submitCustomerOrder({
      chatId,
      items,
      senderName,
      text,
    });

    if (result.ok) {
      await removeCart(chatId);
    }

    return result;
  }

  if (normalizedText.includes("менеджер") || normalizedText.includes("manager")) {
    const managerMessageId = await notifyManagerRequested(chatId, senderName, text);
    const messageId = await sendGreenApiTextMessage(
      chatId,
      "Менеджера позвали. Он подключится к диалогу или свяжется с вами отдельно.",
    );

    return { action: "manager_requested", managerMessageId, messageId, ok: true };
  }

  const numberCommand = parseNumberOnlyCommand(normalizedText);

  if (numberCommand === 0) {
    if (session?.mode === "product" && session.categorySlug) {
      return sendCategory(session.categorySlug);
    }

    if (session?.mode === "category") {
      return sendCatalog();
    }

    const managerMessageId = await notifyManagerRequested(chatId, senderName, text);
    const messageId = await sendGreenApiTextMessage(
      chatId,
      "Менеджера позвали. Если хотите вернуться в каталог, напишите: каталог",
    );

    return { action: "manager_requested", managerMessageId, messageId, ok: true };
  }

  if (numberCommand !== null) {
    if (session?.mode === "catalog") {
      const categorySlug = session.categorySlugs[numberCommand - 1];

      if (categorySlug) {
        return sendCategory(categorySlug);
      }
    }

    if (session?.mode === "category") {
      const product = findSessionProductByNumber(session, products, numberCommand);

      if (product) {
        return sendProduct(product, session.productSlugs);
      }
    }

    if (session?.mode === "product") {
      const product = getProductBySlug(products, session.productSlug);
      const qty = parseStrictPositiveNumber(normalizedText);

      if (product && qty) {
        return addItemsToCart({
          chatId,
          items: [{ product, qty }],
          products,
          senderName,
        });
      }
    }

    const messageId = await sendGreenApiTextMessage(
      chatId,
      "Не нашел такой пункт. Напишите каталог, чтобы начать заново.",
    );

    return { action: "unknown_number", messageId, ok: true };
  }

  const categorySlug = categoryAliases[normalizedText];

  if (categorySlug) {
    return sendCategory(categorySlug);
  }

  const productSlug = normalizedText.replace(/^товар\s+/u, "").trim();
  const product = products.find(
    (candidate) => candidate.slug === productSlug || candidate.id === productSlug,
  );

  if (product) {
    return sendProduct(product);
  }

  if (/^(заказ|заказать|order)\b/u.test(normalizedText)) {
    const items = parseOrderItems(text, products, session);

    if (items.length === 0) {
      const messageId = await sendGreenApiTextMessage(chatId, formatOrderSyntaxError(products));

      return { action: "order_error", messageId, ok: false, reason: "No items" };
    }

    return addItemsToCart({
      chatId,
      items,
      products,
      senderName,
    });
  }

  const messageId = await sendGreenApiTextMessage(
    chatId,
    [
      "Я пока понимаю команды:",
      "каталог",
      "десерты / полуфабрикаты / мясо",
      "товар slug",
      "заказ slug количество",
      "корзина",
      "оформить",
      "менеджер",
    ].join("\n"),
  );

  return { action: "unknown", messageId, ok: true };
}
