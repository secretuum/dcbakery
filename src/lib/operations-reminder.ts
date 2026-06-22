import { fetchProducts } from "@/src/lib/catalog";
import {
  formatResponsiblePersonLine,
  getAllResponsiblePeople,
} from "@/src/lib/responsibles";
import { sendGreenApiTextMessage } from "@/src/lib/whatsapp";
import type { Product } from "@/src/types";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function getLowStockThreshold() {
  const value = Number(process.env.OPERATIONS_LOW_STOCK_THRESHOLD);

  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LOW_STOCK_THRESHOLD;
}

function getReminderTimezone() {
  return process.env.OPERATIONS_REMINDER_TIMEZONE?.trim() || process.env.TIMEZONE?.trim() || "Asia/Almaty";
}

function formatDateTime() {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: getReminderTimezone(),
  }).format(new Date());
}

function formatProductLine(product: Product) {
  const category = product.category?.name ? `${product.category.name}: ` : "";

  return `- ${category}${product.name} — ${product.stock_qty} ${product.unit}`;
}

function formatProductList(products: Product[]) {
  if (products.length === 0) {
    return "нет";
  }

  return products.slice(0, 12).map(formatProductLine).join("\n");
}

function getCategorySummary(products: Product[]) {
  const categories = new Map<string, { products: number; stock: number }>();

  for (const product of products) {
    const categoryName = product.category?.name ?? "Без категории";
    const current = categories.get(categoryName) ?? { products: 0, stock: 0 };

    current.products += 1;
    current.stock += product.stock_qty;
    categories.set(categoryName, current);
  }

  return Array.from(categories.entries())
    .map(([name, summary]) => `- ${name}: ${summary.products} поз., остаток ${summary.stock}`)
    .join("\n");
}

export async function buildOperationsReminderMessage() {
  const products = await fetchProducts();
  const lowStockThreshold = getLowStockThreshold();
  const outOfStockProducts = products.filter((product) => product.stock_qty <= 0);
  const lowStockProducts = products.filter(
    (product) => product.stock_qty > 0 && product.stock_qty <= lowStockThreshold,
  );
  const unavailableProducts = products.filter((product) => !product.is_active);
  const responsiblePeople = getAllResponsiblePeople();

  return [
    "*DC Bakery — операционное напоминание*",
    "",
    `Время: ${formatDateTime()}`,
    `Порог низкого остатка: ${lowStockThreshold}`,
    "",
    "Ответственные:",
    ...responsiblePeople.map(formatResponsiblePersonLine),
    "",
    "Нужно проверить:",
    "1. Стоп-лист",
    "2. Остатки",
    "3. Товары, которые закончились",
    "4. Товары с низким остатком",
    "5. Актуальность каталога на сайте",
    "",
    "Сводка по категориям:",
    getCategorySummary(products) || "нет товаров",
    "",
    `Закончились (${outOfStockProducts.length}):`,
    formatProductList(outOfStockProducts),
    "",
    `Низкий остаток (${lowStockProducts.length}):`,
    formatProductList(lowStockProducts),
    "",
    `Скрыты / неактивны (${unavailableProducts.length}):`,
    formatProductList(unavailableProducts),
  ].join("\n");
}

export async function sendOperationsReminder() {
  const chatId = process.env.GREEN_API_CHAT_ID;

  if (!chatId) {
    return null;
  }

  return sendGreenApiTextMessage(chatId, await buildOperationsReminderMessage());
}
