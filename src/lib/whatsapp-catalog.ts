import "server-only";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
import { formatPrice } from "@/src/lib/format";
import { fetchCategories, fetchProducts } from "@/src/lib/catalog";
import {
  acceptOrderRevision,
  cancelOrder,
  fetchLatestWhatsAppOrderByPhone,
  insertOrderWithItems,
  updateAdminOrderStatus,
  updateOrderCustomerDetails,
  updateOrderTelegramMessageId,
  updateOrderWhatsAppMessageId,
} from "@/src/lib/supabase/admin";
import {
  fetchWhatsAppClientByChatId,
  mergeClientAddressList,
  saveWhatsAppClientProfile,
  type WhatsAppClientAddress,
  type WhatsAppClientProfile,
} from "@/src/lib/whatsapp-client-store";
import { sendTelegramNotification } from "@/src/lib/telegram";
import {
  clearWhatsAppCart,
  fetchWhatsAppCart,
  saveWhatsAppCart,
  type WhatsAppCart,
  type WhatsAppCartItem,
} from "@/src/lib/whatsapp-cart-store";
import {
  replaceWhatsAppOrderMessage,
  sendCustomerOrderCanceledNotification,
  sendGreenApiTextMessage,
  sendWhatsAppNotification,
} from "@/src/lib/whatsapp";
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

type CartOperation = "add" | "remove" | "set";

type ParsedCustomerDetails = Omit<WhatsAppClientProfile, "chatId" | "customerPhone" | "lastOrderId"> & {
  issues?: string[];
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
    }
  | {
      addresses: WhatsAppClientAddress[];
      mode: "checkout_address";
    };

const MAX_CATEGORY_PRODUCTS = 12;
const customerSessions = new Map<string, CustomerSession>();
const customerLastProducts = new Map<string, string>();
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

function appendComment(currentComment: string | null | undefined, nextComment: string) {
  return [currentComment, nextComment].filter(Boolean).join("\n");
}

async function publishManagerOrderUpdate(order: Order, previousMessageId?: string | null) {
  const managerMessageId = await replaceWhatsAppOrderMessage(order, previousMessageId).catch(
    () => null,
  );

  if (managerMessageId) {
    await updateOrderWhatsAppMessageId(order.id, managerMessageId).catch(() => undefined);
  }

  return managerMessageId;
}

function formatProductPrice(product: Product) {
  return product.price > 0 ? formatPrice(product.price) : "Цена уточняется";
}

function getOrderUnit(product: Product) {
  return product.unit === "кг" ? "кг" : "шт.";
}

function formatProductLine(product: Product, index?: number) {
  const weight = product.weightLabel ? `, ${product.weightLabel}` : "";
  const prefix = typeof index === "number" ? `${index + 1}. ` : "- ";

  return `${prefix}${product.name}${weight} — ${formatProductPrice(product)}`;
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

function normalizeSearchText(value: string) {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTokens(value: string) {
  return normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function normalizeSearchToken(value: string) {
  let token = value.replace(/-/g, "");

  if (token.endsWith("аев")) {
    token = `${token.slice(0, -3)}ай`;
  }

  return token
    .replace(/(ами|ями|ого|ему|ыми|ими|аев|оев|иев|ов|ев|ей|ам|ям|ах|ях|ом|ем|ой|ый|ий|ая|яя|ые|ие|а|я|ы|и|е)$/u, "")
    .trim();
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
    "заказ 10 наполеонов — добавить в корзину",
    "корзина — посмотреть корзину",
    "оформить — отправить заявку",
    "профиль — посмотреть сохраненные данные",
    "адреса — посмотреть адреса",
    "менеджер — позвать менеджера",
    "",
    "Пример:",
    "хочу заказать 10 наполеонов",
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
    `Категория: ${product.category?.name ?? "не указано"}`,
    product.weightLabel ? `Вес: ${product.weightLabel}` : null,
    `Цена: ${formatProductPrice(product)}`,
    `Остаток: ${product.stock_qty} ${getOrderUnit(product)}`,
    product.shelfLife ? `Срок годности: ${product.shelfLife}` : null,
    product.storage ? `Хранение: ${product.storage}` : null,
    "",
    product.description,
    "",
    "Чтобы добавить в корзину, напишите количество цифрой, например:",
    "10",
    "",
    `Или командой: заказ 10 ${product.name}`,
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
    return normalizeDeliveryDate(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const dottedMatch = value.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);

  if (dottedMatch) {
    const [, day, month, year] = dottedMatch;

    return normalizeDeliveryDate(year, month, day);
  }

  const shortYearMatch = value.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2})\b/);

  if (shortYearMatch) {
    const [, day, month, year] = shortYearMatch;

    return normalizeDeliveryDate(`20${year}`, month, day);
  }

  const shortDottedMatch = value.match(/\b(\d{1,2})\.(\d{1,2})\b/);

  if (!shortDottedMatch) {
    return null;
  }

  const [, day, month] = shortDottedMatch;
  const year = String(new Date().getFullYear());

  return normalizeDeliveryDate(year, month, day);
}

function normalizeDeliveryDate(year: string, month: string, day: string) {
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return null;
  }

  return iso;
}

function normalizeDeliveryTime(value?: string | null) {
  const text = optional(value);

  if (!text) {
    return null;
  }

  const normalized = normalizeText(text);

  if (
    normalized.includes("договор") ||
    normalized.includes("утро") ||
    normalized.includes("день") ||
    normalized.includes("вечер")
  ) {
    return text;
  }

  const rangeMatch = normalized.match(/\b([01]?\d|2[0-3])\s*[-–—]\s*([01]?\d|2[0-3])\b/);

  if (rangeMatch) {
    return `${rangeMatch[1].padStart(2, "0")}:00-${rangeMatch[2].padStart(2, "0")}:00`;
  }

  const timeMatch = normalized.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\b/);

  if (timeMatch) {
    return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}`;
  }

  return null;
}

function parseCustomerDetails(text: string): ParsedCustomerDetails {
  const rawDeliveryDate = readField(text, ["дата доставки", "дата", "delivery_date", "delivery date"]);
  const rawDeliveryTime = readField(text, ["время доставки", "время", "delivery time", "time"]);
  const deliveryDate = parseDate(rawDeliveryDate);
  const deliveryTime = normalizeDeliveryTime(rawDeliveryTime);
  const issues = [
    rawDeliveryDate && !deliveryDate
      ? "Дата доставки не распознана или уже прошла. Напишите, например: 25.06 или 2026-06-25."
      : null,
    rawDeliveryTime && !deliveryTime
      ? "Время доставки не распознано. Напишите, например: 8-12, 12-18, 14:30 или договориться."
      : null,
  ].filter((issue): issue is string => Boolean(issue));

  return {
    companyName: readField(text, ["компания", "заведение", "company"]),
    customerBin: readField(text, ["бин/ип", "бин ип", "бин", "ип", "customer_bin", "bin", "iin"]),
    customerName: readField(text, ["контактное лицо", "контакт", "имя", "name"]),
    customerEmail: readField(text, ["email", "e-mail", "почта"]),
    deliveryAddress: readField(text, ["адрес доставки", "адрес", "address"]),
    deliveryDate,
    deliveryTime,
    paymentMethod: readField(text, ["способ оплаты", "оплата", "payment"]),
    comment: readField(text, ["комментарий", "примечание", "comment"]),
    issues,
  };
}

function hasCustomerDetails(details: ParsedCustomerDetails) {
  return Object.entries(details).some(
    ([key, value]) => key !== "issues" && typeof value === "string" && optional(value),
  );
}

function formatProfileLine(label: string, value?: string | null) {
  return `${label}: ${optional(value) ?? "не указано"}`;
}

function formatAddressList(addresses: WhatsAppClientAddress[] = []) {
  if (addresses.length === 0) {
    return "Адреса пока не сохранены.";
  }

  return addresses
    .map((item, index) => `${index + 1}. ${item.label ? `${item.label}: ` : ""}${item.address}`)
    .join("\n");
}

function formatCustomerProfileMessage(profile: WhatsAppClientProfile | null) {
  if (!profile) {
    return [
      "*Профиль DC Bakery*",
      "",
      "Пока данных нет. После подтверждения заявки менеджером бот попросит реквизиты и адрес доставки.",
    ].join("\n");
  }

  return [
    "*Профиль DC Bakery*",
    "",
    formatProfileLine("Компания", profile.companyName),
    formatProfileLine("БИН/ИП", profile.customerBin),
    formatProfileLine("Контакт", profile.customerName),
    formatProfileLine("Email", profile.customerEmail),
    formatProfileLine("Телефон", profile.customerPhone),
    formatProfileLine("Адрес доставки", profile.deliveryAddress),
    "",
    "*Адреса:*",
    formatAddressList(profile.addresses),
    "",
    formatProfileLine("Дата доставки", profile.deliveryDate),
    formatProfileLine("Время доставки", profile.deliveryTime),
    formatProfileLine("Оплата", profile.paymentMethod),
    "",
    "Чтобы обновить данные, отправьте их по шаблону:",
    "Компания:",
    "БИН/ИП:",
    "Контакт:",
    "Email:",
    "Адрес доставки:",
    "Дата доставки:",
    "Время доставки:",
    "Оплата:",
    "",
    "Добавить адрес можно так:",
    "адрес добавить Самал, ул. Абая 10",
  ].join("\n");
}

function formatCustomerDetailsSavedMessage({
  orderNumber,
  profile,
}: {
  orderNumber?: string;
  profile: WhatsAppClientProfile;
}) {
  return [
    orderNumber
      ? `*Данные по заявке ${orderNumber} сохранены*`
      : "*Данные клиента сохранены*",
    "",
    formatProfileLine("Компания", profile.companyName),
    formatProfileLine("БИН/ИП", profile.customerBin),
    formatProfileLine("Контакт", profile.customerName),
    formatProfileLine("Email", profile.customerEmail),
    formatProfileLine("Адрес доставки", profile.deliveryAddress),
    formatProfileLine("Дата доставки", profile.deliveryDate),
    formatProfileLine("Время доставки", profile.deliveryTime),
    formatProfileLine("Оплата", profile.paymentMethod),
    "",
    orderNumber
      ? "Менеджер увидит обновление в заявке. Позже здесь появятся история и повтор последнего заказа."
      : "Заявку по этому номеру пока не нашел. Данные сохранены в профиль, менеджер сможет связать их вручную.",
  ].join("\n");
}

function formatCustomerDetailsIssuesMessage(issues: string[]) {
  return [
    "*Нужно уточнить данные*",
    "",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "Отправьте исправленное поле отдельным сообщением, например:",
    "Дата доставки: 25.06",
    "Время доставки: 8-12",
  ].join("\n");
}

function formatManagerCustomerDetailsMessage({
  orderNumber,
  phone,
  profile,
}: {
  orderNumber?: string;
  phone: string;
  profile: WhatsAppClientProfile;
}) {
  return [
    "*Клиент отправил данные для доставки*",
    orderNumber ? `Заявка: ${orderNumber}` : null,
    `Телефон: ${phone}`,
    "",
    formatProfileLine("Компания", profile.companyName),
    formatProfileLine("БИН/ИП", profile.customerBin),
    formatProfileLine("Контакт", profile.customerName),
    formatProfileLine("Email", profile.customerEmail),
    formatProfileLine("Адрес", profile.deliveryAddress),
    formatProfileLine("Дата", profile.deliveryDate),
    formatProfileLine("Время", profile.deliveryTime),
    formatProfileLine("Оплата", profile.paymentMethod),
    profile.comment ? `Комментарий: ${profile.comment}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCustomerAddressesMessage(profile: WhatsAppClientProfile | null) {
  const addresses = profile?.addresses ?? [];

  return [
    "*Адреса доставки*",
    "",
    formatAddressList(addresses),
    "",
    "Команды:",
    "адрес добавить Самал, ул. Абая 10",
    "адрес 2 — выбрать адрес по умолчанию",
    "",
    addresses.length > 1 ? "При оформлении заказа бот предложит выбрать адрес цифрой." : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCheckoutAddressChoiceMessage(addresses: WhatsAppClientAddress[]) {
  return [
    "*Выберите адрес доставки*",
    "",
    formatAddressList(addresses),
    "",
    "Ответьте цифрой адреса, например: 1",
    "Или отправьте новый адрес так:",
    "Адрес доставки: Самал, ул. Абая 10",
  ].join("\n");
}

function parseAddAddressCommand(normalizedText: string, originalText: string) {
  if (!normalizedText.startsWith("адрес добавить ")) {
    return null;
  }

  return optional(originalText.replace(/^адрес\s+добавить\s+/i, ""));
}

function parseSelectAddressCommand(normalizedText: string) {
  const match = normalizedText.match(/^адрес\s+(\d+)$/u);

  return match ? Number(match[1]) - 1 : null;
}

function parseCategoryQuickAdd(text: string, session?: CustomerSession) {
  if (session?.mode !== "category") {
    return null;
  }

  const match = normalizeText(text).match(/^(\d+)\s+(\d+(?:[.,]\d+)?)$/u);

  if (!match) {
    return null;
  }

  return {
    optionNumber: Number(match[1]),
    qty: Number(match[2].replace(",", ".")),
  };
}

function getEditDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const insertCost = previous[j] + 1;
      const deleteCost = previous[j - 1] + 1;
      const replaceCost = diagonal + (a[i - 1] === b[j - 1] ? 0 : 1);

      diagonal = previous[j];
      previous[j] = Math.min(insertCost, deleteCost, replaceCost);
    }
  }

  return previous[b.length];
}

function getTokenMatchScore(productToken: string, segmentToken: string) {
  if (!productToken || !segmentToken) {
    return 0;
  }

  if (productToken === segmentToken) {
    return productToken.length;
  }

  if (
    productToken.length >= 4 &&
    segmentToken.length >= 4 &&
    (productToken.includes(segmentToken) || segmentToken.includes(productToken))
  ) {
    return Math.min(productToken.length, segmentToken.length) - 1;
  }

  const minLength = Math.min(productToken.length, segmentToken.length);
  const maxLength = Math.max(productToken.length, segmentToken.length);
  const allowedDistance = minLength >= 8 ? 4 : minLength >= 6 ? 2 : 1;

  if (minLength < 5 || productToken[0] !== segmentToken[0] || maxLength - minLength > allowedDistance) {
    return 0;
  }

  const distance = getEditDistance(productToken, segmentToken);

  return distance <= allowedDistance ? Math.max(1, minLength - distance) : 0;
}

function getProductSearchScore(product: Product, segment: string) {
  const segmentTokens = getSearchTokens(segment).map(normalizeSearchToken).filter(Boolean);

  if (segmentTokens.length === 0) {
    return 0;
  }

  const productTokens = getSearchTokens(
    `${product.name} ${product.slug} ${product.id} ${product.subcategory ?? ""} ${product.weightLabel ?? ""}`,
  )
    .map(normalizeSearchToken)
    .filter(Boolean);
  let score = 0;

  for (const token of productTokens) {
    let bestTokenScore = 0;

    for (const segmentToken of segmentTokens) {
      bestTokenScore = Math.max(bestTokenScore, getTokenMatchScore(token, segmentToken));
    }

    score += bestTokenScore;
  }

  const normalizedSegment = normalizeSearchText(segment);
  const productName = normalizeSearchText(product.name);
  const segmentMentionsCake = /\bторт\w*\b/u.test(normalizedSegment);
  const productIsCake = productName.startsWith("торт ") || product.subcategory === "Торты";

  if (normalizedSegment.includes(productName)) {
    score += 20;
  }

  if (segmentMentionsCake && productIsCake) {
    score += 8;
  }

  if (!segmentMentionsCake && productIsCake) {
    score -= 8;
  }

  return score;
}

function resolveProductFromNaturalText(segment: string, products: Product[]) {
  const matches = products
    .map((product) => ({ product, score: getProductSearchScore(product, segment) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.length - b.product.name.length);

  return matches[0]?.product ?? null;
}

function isCategoryProductReferenceSegment(segment: string, session?: CustomerSession) {
  return session?.mode === "category" && /^\s*\d+\s+\d+(?:[.,]\d+)?(?:\s|$)/u.test(segment);
}

function resolveProductFromOrderSegment(
  segment: string,
  products: Product[],
  session?: CustomerSession,
  fallbackProduct?: Product | null,
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

  if (optionMatch && isCategoryProductReferenceSegment(segment, session)) {
    return findSessionProductByNumber(session, products, Number(optionMatch[1]));
  }

  if (session?.mode === "product") {
    return getProductBySlug(products, session.productSlug);
  }

  return resolveProductFromNaturalText(segment, products) ?? fallbackProduct ?? null;
}

function resolveQtyFromOrderSegment(segment: string, hasNumericProductReference: boolean) {
  const matches = Array.from(segment.matchAll(/\d+(?:[.,]\d+)?/g));
  const qtyMatch = hasNumericProductReference ? matches[1] : matches[0];
  const qty = qtyMatch ? Number(qtyMatch[0].replace(",", ".")) : 1;

  return Number.isFinite(qty) && qty > 0 ? qty : null;
}

function normalizeNoisyQuantityText(text: string) {
  return text.replace(/(\d)[^\d\s,.;:]+(?=\d)/gu, "$1");
}

function stripOrderCommandPrefix(text: string) {
  return text
    .replace(/^(заказ|заказать|order|хочу|нужно|надо|добавь|добавить|еще|ещё)\b/u, "")
    .trim();
}

function trimOrderSegment(value: string) {
  return value
    .replace(/^(и|плюс|еще|ещё)\s+/u, "")
    .replace(/\s+(и|плюс|еще|ещё)$/u, "")
    .trim();
}

function getOrderSegments(text: string) {
  const normalizedText = normalizeNoisyQuantityText(normalizeText(text));
  const commandlessText = stripOrderCommandPrefix(normalizedText);
  const quantitySegments = Array.from(
    commandlessText.matchAll(
      /(?:^|[\s,;]+)(\d+(?:[.,]\d+)?)\s+(.+?)(?=(?:[\s,;]+(?:и\s+|плюс\s+|еще\s+|ещё\s+)?\d+(?:[.,]\d+)?\s+)|$)/gu,
    ),
  )
    .map((match) => `${match[1]} ${trimOrderSegment(match[2])}`.trim())
    .filter((segment) => /\p{L}|\d+\s+\d/u.test(segment));

  if (quantitySegments.length > 0) {
    return quantitySegments;
  }

  return commandlessText
    .split(/[\n,;]+/)
    .map((segment) => trimOrderSegment(segment))
    .filter(Boolean);
}

function parseOrderItems(
  text: string,
  products: Product[],
  session?: CustomerSession,
  fallbackProduct?: Product | null,
) {
  const segments = getOrderSegments(text);
  const parsedItems: ParsedOrderItem[] = [];

  for (const segment of segments) {
    const product = resolveProductFromOrderSegment(segment, products, session, fallbackProduct);

    if (!product) {
      continue;
    }

    const hasNumericProductReference = isCategoryProductReferenceSegment(segment, session);
    const qty = resolveQtyFromOrderSegment(segment, hasNumericProductReference);

    if (qty) {
      parsedItems.push({ product, qty });
    }
  }

  return parsedItems;
}

function looksLikeNaturalOrder(text: string) {
  const normalizedText = normalizeNoisyQuantityText(normalizeText(text));

  return (
    /\d/.test(normalizedText) &&
    /(заказ|заказать|возьм|нужн|хочу|добав|полож|можно|надо|еще|ещё|убер|удал|минус|сделай|оставь|только)/u.test(
      normalizedText,
    )
  );
}

function looksLikeShortProductQty(text: string, session?: CustomerSession) {
  const normalizedText = normalizeNoisyQuantityText(normalizeText(text));

  return /^\d+(?:[.,]\d+)?\s+[\p{L}\p{N}-]+/u.test(normalizedText) ||
    (session?.mode === "category" && /^\d+\s+\d+(?:[.,]\d+)?$/u.test(normalizedText));
}

function getCartOperation(text: string): CartOperation {
  const normalizedText = normalizeText(text);

  if (/(убер|убрать|удали|удалить|минус|вычти)/u.test(normalizedText)) {
    return "remove";
  }

  if (/(только|сделай|оставь|пусть будет|измени|поменяй)/u.test(normalizedText)) {
    return "set";
  }

  return "add";
}

function formatOrderSyntaxError(products: Product[]) {
  const exampleProduct = products[0];

  return [
    "*Не понял заказ*",
    "",
    "Напишите так:",
    `заказ 10 ${exampleProduct?.name ?? "Наполеон"}`,
    "",
    "Можно несколько позиций:",
    `заказ 10 ${exampleProduct?.name ?? "Наполеон"}, 5 ${products[1]?.name ?? "эклеров"}`,
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

async function getFallbackProductForCartCommand(chatId: string, products: Product[]) {
  const lastProduct = getProductBySlug(products, customerLastProducts.get(chatId));

  if (lastProduct) {
    return lastProduct;
  }

  const cart = await loadCart(chatId);
  const resolvedItems = resolveCartItems(cart.items, products);

  return resolvedItems.length === 1 ? resolvedItems[0].product : null;
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

    return `${index + 1}. ${product.name} x ${qty} ${getOrderUnit(product)} = ${total}`;
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

function mergeCartItems(
  currentItems: WhatsAppCartItem[],
  nextItems: ParsedOrderItem[],
  operation: CartOperation,
) {
  const nextItemMap = new Map(currentItems.map((item) => [item.productId, item.qty]));

  for (const item of nextItems) {
    const currentQty = nextItemMap.get(item.product.id) ?? 0;

    if (operation === "set") {
      nextItemMap.set(item.product.id, item.qty);
    } else if (operation === "remove") {
      nextItemMap.set(item.product.id, Math.max(0, currentQty - item.qty));
    } else {
      nextItemMap.set(item.product.id, currentQty + item.qty);
    }
  }

  return Array.from(nextItemMap.entries())
    .map(([productId, qty]) => ({ productId, qty }))
    .filter((item) => item.qty > 0);
}

async function addItemsToCart({
  chatId,
  items,
  operation = "add",
  products,
  senderName,
}: {
  chatId: string;
  items: ParsedOrderItem[];
  operation?: CartOperation;
  products: Product[];
  senderName?: string;
}) {
  const cart = await loadCart(chatId);
  const savedCart = await persistCart({
    chatId,
    customerPhone: getPhoneFromChatId(chatId),
    items: mergeCartItems(cart.items, items, operation),
    senderName: optional(senderName) ?? cart.senderName ?? null,
  });
  const resolvedItems = resolveCartItems(savedCart.items, products);
  const title =
    operation === "remove"
      ? "*Убрано из корзины*"
      : operation === "set"
        ? "*Количество изменено*"
        : "*Добавлено в корзину*";

  for (const item of items) {
    customerLastProducts.set(chatId, item.product.id);
  }

  const messageId = await sendGreenApiTextMessage(
    chatId,
    [
      title,
      "",
      ...items.map((item) => `- ${item.product.name} x ${item.qty} ${getOrderUnit(item.product)}`),
      "",
      formatCartMessage(resolvedItems),
    ].join("\n"),
  );

  return { action: "cart_updated", messageId, ok: true };
}

async function getPreferredDeliveryAddress(chatId: string, explicitAddress?: string | null) {
  if (explicitAddress) {
    return explicitAddress;
  }

  const savedProfile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  const addresses = savedProfile?.addresses ?? [];

  if (addresses.length === 0) {
    return savedProfile?.deliveryAddress ?? null;
  }

  const index = Math.min(
    Math.max(savedProfile?.primaryAddressIndex ?? 0, 0),
    addresses.length - 1,
  );

  return addresses[index]?.address ?? savedProfile?.deliveryAddress ?? null;
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
  const savedProfile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  const details = parseCustomerDetails(text);
  const companyName = details.companyName ?? savedProfile?.companyName ?? "WhatsApp клиент";
  const customerBin = details.customerBin ?? savedProfile?.customerBin ?? null;
  const customerName =
    details.customerName ??
    savedProfile?.customerName ??
    optional(senderName) ??
    "WhatsApp клиент";
  const customerEmail = details.customerEmail ?? savedProfile?.customerEmail ?? null;
  const deliveryDate = details.deliveryDate ?? getTomorrowDate();
  const deliveryAddress = await getPreferredDeliveryAddress(chatId, details.deliveryAddress);
  const deliveryTime =
    details.deliveryTime ?? savedProfile?.deliveryTime ?? "Договориться с менеджером";
  const paymentMethod =
    details.paymentMethod ?? savedProfile?.paymentMethod ?? "Договориться с менеджером";
  const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const orderItems: OrderItem[] = items.map(({ product, qty }) => ({
    category: product.category?.name ?? null,
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: product.id,
    product_name: product.name,
    unit: getOrderUnit(product),
    qty,
    price: product.price,
    total_amount: product.price * qty,
  }));
  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    source: "whatsapp",
    company_name: companyName,
    customer_bin: customerBin,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    delivery_address: deliveryAddress,
    delivery_date: deliveryDate,
    delivery_time: deliveryTime,
    payment_method: paymentMethod,
    comment: [
      `Заявка из WhatsApp. Чат клиента: ${chatId}`,
      details.comment ? `Комментарий клиента: ${details.comment}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    status: "pending_manager_confirmation",
    total_amount: totalAmount,
    payment_status: "unpaid",
    created_at: new Date().toISOString(),
  };

  await insertOrderWithItems(order, orderItems);

  await saveWhatsAppClientProfile({
    chatId,
    companyName,
    customerBin,
    customerEmail,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryDate: details.deliveryDate ?? undefined,
    deliveryTime,
    paymentMethod,
    comment: details.comment,
    addresses: mergeClientAddressList(savedProfile?.addresses, deliveryAddress),
    lastOrderId: orderId,
  }).catch((error) => {
    console.warn("[whatsapp:client] Failed to save profile after order:", error);
  });

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

function detailValue(value?: string | null) {
  return optional(value) ?? undefined;
}

async function handleCustomerDetailsSubmission({
  chatId,
  details,
}: {
  chatId: string;
  details: ParsedCustomerDetails;
}) {
  if (details.issues && details.issues.length > 0) {
    const messageId = await sendGreenApiTextMessage(
      chatId,
      formatCustomerDetailsIssuesMessage(details.issues),
    );

    return {
      action: "customer_details_invalid",
      messageId,
      ok: false,
      reason: "Invalid customer details",
    };
  }

  const customerPhone = getPhoneFromChatId(chatId);
  const currentProfile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  const order = await fetchLatestWhatsAppOrderByPhone(customerPhone).catch((error) => {
    console.warn("[whatsapp:client] Failed to fetch latest order:", error);
    return null;
  });
  const orderPatch = {
    company_name: detailValue(details.companyName),
    customer_bin: detailValue(details.customerBin),
    customer_name: detailValue(details.customerName),
    customer_email: detailValue(details.customerEmail),
    delivery_address: detailValue(details.deliveryAddress),
    delivery_date: detailValue(details.deliveryDate),
    delivery_time: detailValue(details.deliveryTime),
    payment_method: detailValue(details.paymentMethod),
    comment:
      order && details.comment
        ? [order.comment, `Комментарий клиента: ${details.comment}`].filter(Boolean).join("\n")
        : undefined,
  };
  const updatedOrder = order
    ? await updateOrderCustomerDetails(order.id, orderPatch).catch((error) => {
        console.warn("[whatsapp:client] Failed to update order details:", error);
        return order;
      })
    : null;
  let savedProfile: WhatsAppClientProfile = {
    chatId,
    companyName: details.companyName ?? null,
    customerBin: details.customerBin ?? null,
    customerEmail: details.customerEmail ?? null,
    customerName: details.customerName ?? null,
    customerPhone,
    deliveryAddress: details.deliveryAddress ?? null,
    deliveryDate: details.deliveryDate ?? null,
    deliveryTime: details.deliveryTime ?? null,
    paymentMethod: details.paymentMethod ?? null,
    comment: details.comment ?? null,
    lastOrderId: updatedOrder?.id ?? order?.id ?? null,
  };

  try {
    savedProfile = await saveWhatsAppClientProfile({
      chatId,
      companyName: detailValue(details.companyName),
      customerBin: detailValue(details.customerBin),
      customerEmail: detailValue(details.customerEmail),
      customerName: detailValue(details.customerName),
      customerPhone,
      deliveryAddress: detailValue(details.deliveryAddress),
      deliveryDate: detailValue(details.deliveryDate),
      deliveryTime: detailValue(details.deliveryTime),
      paymentMethod: detailValue(details.paymentMethod),
      comment: detailValue(details.comment),
      addresses: mergeClientAddressList(currentProfile?.addresses, details.deliveryAddress),
      lastOrderId: updatedOrder?.id ?? order?.id ?? undefined,
    });
  } catch (error) {
    console.warn("[whatsapp:client] Failed to save profile details:", error);
  }

  const managerChatId = process.env.GREEN_API_CHAT_ID;
  const orderNumber = updatedOrder?.order_number ?? order?.order_number;

  if (managerChatId) {
    await sendGreenApiTextMessage(
      managerChatId,
      formatManagerCustomerDetailsMessage({
        orderNumber,
        phone: customerPhone,
        profile: savedProfile,
      }),
    ).catch(() => null);
  }

  const messageId = await sendGreenApiTextMessage(
    chatId,
    formatCustomerDetailsSavedMessage({
      orderNumber,
      profile: savedProfile,
    }),
  );

  return {
    action: "customer_details_saved",
    messageId,
    ok: true,
    orderId: updatedOrder?.id ?? order?.id ?? null,
    orderNumber: orderNumber ?? null,
  };
}

function isAcceptRevisionCommand(text: string) {
  const normalizedText = normalizeText(text);

  return /^(принять|согласен|согласна|ок|да)$/u.test(normalizedText);
}

function isCancelOrderCommand(text: string) {
  const normalizedText = normalizeText(text);

  return /^(отменить|отмена|отмени|cancel)(\s|$)/u.test(normalizedText) ||
    normalizedText.includes("отменить заявку");
}

function getChangeRequestComment(text: string) {
  const normalizedText = normalizeText(text);

  if (!/^(изменить|правка|поменять|измени)(\s|$)/u.test(normalizedText)) {
    return null;
  }

  return optional(text.replace(/^(изменить|правка|поменять|измени)\s*/i, ""));
}

async function handleClientOrderResponse({
  chatId,
  text,
}: {
  chatId: string;
  text: string;
}) {
  const customerPhone = getPhoneFromChatId(chatId);
  const order = await fetchLatestWhatsAppOrderByPhone(customerPhone).catch(() => null);

  if (!order || order.status === "completed" || order.status === "canceled" || order.status === "cancelled") {
    return null;
  }

  if (order.payment_status === "paid" || order.status === "paid") {
    return null;
  }

  if (isAcceptRevisionCommand(text)) {
    if (order.status !== "change_proposed") {
      return null;
    }

    const acceptedOrder = await acceptOrderRevision(order.id);

    if (!acceptedOrder) {
      return null;
    }

    const managerMessageId = await publishManagerOrderUpdate(acceptedOrder, order.whatsapp_message_id);
    const messageId = await sendGreenApiTextMessage(
      chatId,
      `Измененная заявка ${order.order_number} принята. Менеджер подтвердит заказ и отправит оплату.`,
    );

    return {
      action: "revision_accepted",
      managerMessageId,
      messageId,
      ok: true,
      orderId: acceptedOrder.id,
    };
  }

  if (isCancelOrderCommand(text)) {
    const reason = optional(text.replace(/^(отменить|отмена|отмени|cancel)\s*/i, ""));
    const canceledOrder = await cancelOrder(order.id, "client", reason);

    if (!canceledOrder) {
      return null;
    }

    const managerMessageId = await publishManagerOrderUpdate(canceledOrder, order.whatsapp_message_id);
    const messageId = await sendCustomerOrderCanceledNotification(canceledOrder);

    return {
      action: "order_canceled_by_client",
      managerMessageId,
      messageId,
      ok: true,
      orderId: canceledOrder.id,
    };
  }

  const changeComment = getChangeRequestComment(text);

  if (changeComment) {
    await updateOrderCustomerDetails(order.id, {
      comment: appendComment(order.comment, `Клиент просит изменить заявку: ${changeComment}`),
      revision_note: `Клиент просит изменить: ${changeComment}`,
    });
    const updatedOrder = await updateAdminOrderStatus(order.id, "pending_manager_confirmation");

    if (!updatedOrder) {
      return null;
    }

    const managerMessageId = await publishManagerOrderUpdate(updatedOrder, order.whatsapp_message_id);
    const messageId = await sendGreenApiTextMessage(
      chatId,
      "Передал пожелание менеджеру. Он проверит остатки и отправит обновленную заявку.",
    );

    return {
      action: "revision_change_requested",
      managerMessageId,
      messageId,
      ok: true,
      orderId: updatedOrder.id,
    };
  }

  return null;
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

  const orderResponse = await handleClientOrderResponse({ chatId, text });

  if (orderResponse) {
    return orderResponse;
  }

  const addedAddress = parseAddAddressCommand(normalizedText, text);

  if (addedAddress) {
    const profile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
    const savedProfile = await saveWhatsAppClientProfile({
      chatId,
      customerPhone: getPhoneFromChatId(chatId),
      deliveryAddress: profile?.deliveryAddress ?? addedAddress,
      addresses: mergeClientAddressList(profile?.addresses, addedAddress),
      primaryAddressIndex: profile?.primaryAddressIndex ?? 0,
    }).catch((error) => {
      console.warn("[whatsapp:client] Failed to add address:", error);
      return null;
    });
    const messageId = await sendGreenApiTextMessage(
      chatId,
      savedProfile
        ? ["Адрес добавлен.", "", formatCustomerAddressesMessage(savedProfile)].join("\n")
        : "Не смог сохранить адрес. Попробуйте позже или напишите менеджер.",
    );

    return { action: "address_added", messageId, ok: Boolean(savedProfile) };
  }

  if (normalizedText === "адреса" || normalizedText === "addresses") {
    const profile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
    const messageId = await sendGreenApiTextMessage(chatId, formatCustomerAddressesMessage(profile));

    return { action: "addresses", messageId, ok: true };
  }

  const selectedAddressIndex = parseSelectAddressCommand(normalizedText);

  if (selectedAddressIndex !== null) {
    const profile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
    const selectedAddress = profile?.addresses?.[selectedAddressIndex];

    if (!profile || !selectedAddress) {
      const messageId = await sendGreenApiTextMessage(
        chatId,
        "Не нашел такой адрес. Напишите: адреса",
      );

      return { action: "address_not_found", messageId, ok: false };
    }

    const savedProfile = await saveWhatsAppClientProfile({
      chatId,
      deliveryAddress: selectedAddress.address,
      primaryAddressIndex: selectedAddressIndex,
    }).catch((error) => {
      console.warn("[whatsapp:client] Failed to select address:", error);
      return null;
    });
    const messageId = await sendGreenApiTextMessage(
      chatId,
      savedProfile
        ? `Адрес по умолчанию: ${selectedAddress.address}`
        : "Не смог выбрать адрес. Попробуйте позже.",
    );

    return { action: "address_selected", messageId, ok: Boolean(savedProfile) };
  }

  if (normalizedText === "профиль" || normalizedText === "profile") {
    const profile = await fetchWhatsAppClientByChatId(chatId).catch((error) => {
      console.warn("[whatsapp:client] Failed to fetch profile:", error);
      return null;
    });
    const messageId = await sendGreenApiTextMessage(chatId, formatCustomerProfileMessage(profile));

    return { action: "profile", messageId, ok: true };
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

    const totalAmount = getCartTotal(items);
    const hasUnknownPrice = items.some((item) => item.product.price <= 0);

    if (!hasUnknownPrice && totalAmount < MIN_ORDER_AMOUNT) {
      const messageId = await sendGreenApiTextMessage(chatId, formatMinimumOrderMessage(totalAmount));

      return { action: "order_error", messageId, ok: false, reason: "Minimum order" };
    }

    const details = parseCustomerDetails(text);

    if (details.issues && details.issues.length > 0) {
      const messageId = await sendGreenApiTextMessage(
        chatId,
        formatCustomerDetailsIssuesMessage(details.issues),
      );

      return { action: "checkout_details_invalid", messageId, ok: false };
    }

    const profile = await fetchWhatsAppClientByChatId(chatId).catch(() => null);

    if (!details.deliveryAddress && (profile?.addresses?.length ?? 0) > 1) {
      customerSessions.set(chatId, {
        addresses: profile?.addresses ?? [],
        mode: "checkout_address",
      });

      const messageId = await sendGreenApiTextMessage(
        chatId,
        formatCheckoutAddressChoiceMessage(profile?.addresses ?? []),
      );

      return { action: "checkout_address_required", messageId, ok: false };
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

  const categoryQuickAdd = parseCategoryQuickAdd(text, session);

  if (categoryQuickAdd) {
    const product = findSessionProductByNumber(session, products, categoryQuickAdd.optionNumber);

    if (product && Number.isFinite(categoryQuickAdd.qty) && categoryQuickAdd.qty > 0) {
      return addItemsToCart({
        chatId,
        items: [{ product, qty: categoryQuickAdd.qty }],
        products,
        senderName,
      });
    }
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
    if (session?.mode === "checkout_address") {
      const selectedAddress = session.addresses[numberCommand - 1];

      if (!selectedAddress) {
        const messageId = await sendGreenApiTextMessage(
          chatId,
          ["Не нашел такой адрес.", "", formatCheckoutAddressChoiceMessage(session.addresses)].join(
            "\n",
          ),
        );

        return { action: "checkout_address_not_found", messageId, ok: false };
      }

      const cart = await loadCart(chatId);
      const items = resolveCartItems(cart.items, products);

      if (items.length === 0) {
        customerSessions.delete(chatId);
        const messageId = await sendGreenApiTextMessage(chatId, formatCartMessage([]));

        return { action: "cart_empty", messageId, ok: false };
      }

      await saveWhatsAppClientProfile({
        chatId,
        deliveryAddress: selectedAddress.address,
        primaryAddressIndex: numberCommand - 1,
      }).catch(() => null);

      const result = await submitCustomerOrder({
        chatId,
        items,
        senderName,
        text: `${text}\nАдрес доставки: ${selectedAddress.address}`,
      });

      if (result.ok) {
        customerSessions.delete(chatId);
        await removeCart(chatId);
      }

      return result;
    }

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

  if (
    /^(заказ|заказать|order)\b/u.test(normalizedText) ||
    looksLikeNaturalOrder(text) ||
    looksLikeShortProductQty(text, session)
  ) {
    const operation = getCartOperation(text);
    const fallbackProduct = await getFallbackProductForCartCommand(chatId, products);
    const items = parseOrderItems(text, products, session, fallbackProduct);

    if (items.length === 0) {
      const messageId = await sendGreenApiTextMessage(chatId, formatOrderSyntaxError(products));

      return { action: "order_error", messageId, ok: false, reason: "No items" };
    }

    return addItemsToCart({
      chatId,
      items,
      operation,
      products,
      senderName,
    });
  }

  const details = parseCustomerDetails(text);

  if (hasCustomerDetails(details)) {
    return handleCustomerDetailsSubmission({
      chatId,
      details,
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
      "профиль",
      "менеджер",
    ].join("\n"),
  );

  return { action: "unknown", messageId, ok: true };
}
