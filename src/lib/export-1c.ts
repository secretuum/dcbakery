import "server-only";
import { fetchAdminOrders, fetchAllClients } from "@/src/lib/supabase/admin";
import { orderStatusLabels } from "@/src/lib/order-status";
import type { Order } from "@/src/types";

// Выгрузка для 1С Бухгалтерии (фаза 0): плоские CSV-файлы, которые бухгалтер
// открывает в Excel или загружает обработкой. UTF-8 с BOM и разделителем «;» —
// русский Excel открывает такой файл двойным кликом без вопросов про кодировку.

type OrderItemRow = {
  order_id?: string;
  product_name?: string;
  qty?: number;
  unit?: string;
  price?: number;
  total_amount?: number;
};

const paymentLabels: Record<string, string> = {
  unpaid: "Не оплачен",
  payment_link_created: "Счёт подготовлен",
  payment_link_sent: "Счёт отправлен",
  partial: "Частичная оплата",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
  expired: "Просрочен",
  refunded: "Возврат",
};

// Статусы, которые не имеют смысла для бухгалтерии
const EXCLUDED_STATUSES = new Set(["canceled", "cancelled"]);
const UNCONFIRMED_STATUSES = new Set(["pending_manager_confirmation", "new", "change_proposed"]);

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]) {
  // ﻿ — BOM, чтобы Excel сразу понял UTF-8
  return "﻿" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeZone: "Asia/Almaty" }).format(date);
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

async function fetchAllOrderItems(): Promise<OrderItemRow[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return [];
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/order_items?select=order_id,product_name,qty,unit,price,total_amount`;
  const rows: OrderItemRow[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const response = await fetch(baseUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Range: `${from}-${from + PAGE_SIZE - 1}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      break;
    }

    const batch = (await response.json()) as OrderItemRow[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function filterOrdersByPeriod(orders: Order[], from: string, to: string, confirmedOnly: boolean) {
  const fromTime = new Date(`${from}T00:00:00+05:00`).getTime();
  const toTime = new Date(`${to}T23:59:59+05:00`).getTime();

  return orders.filter((order) => {
    const created = new Date(order.created_at).getTime();

    if (Number.isNaN(created) || created < fromTime || created > toTime) {
      return false;
    }

    if (EXCLUDED_STATUSES.has(order.status)) {
      return false;
    }

    if (confirmedOnly && UNCONFIRMED_STATUSES.has(order.status)) {
      return false;
    }

    return true;
  });
}

export type ExportOrder = {
  number: string;
  date: string;
  status: string;
  payment: string;
  company: string;
  bin: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  deliveryDate: string;
  total: number;
  items: Array<{ name: string; qty: number; unit: string; price: number; sum: number }>;
};

/** Структурированные заказы за период — общий источник для CSV и JSON-эндпоинта 1С. */
export async function collectOrders(
  from: string,
  to: string,
  confirmedOnly: boolean,
): Promise<ExportOrder[]> {
  const [allOrders, allItems] = await Promise.all([fetchAdminOrders(), fetchAllOrderItems()]);
  const orders = filterOrdersByPeriod(allOrders, from, to, confirmedOnly);
  const itemsByOrderId = new Map<string, OrderItemRow[]>();

  for (const item of allItems) {
    if (!item.order_id) {
      continue;
    }
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrderId.set(item.order_id, list);
  }

  return orders.map((order) => ({
    number: order.order_number,
    date: order.created_at,
    status: orderStatusLabels[order.status] ?? order.status,
    payment: order.payment_status
      ? paymentLabels[order.payment_status] ?? order.payment_status
      : "",
    company: order.company_name,
    bin: order.customer_bin ?? "",
    contact: order.customer_name,
    phone: order.customer_phone,
    email: order.customer_email ?? "",
    address: order.delivery_address ?? "",
    deliveryDate: order.delivery_date ?? "",
    total: order.total_amount,
    items: (itemsByOrderId.get(order.id) ?? []).map((item) => ({
      name: item.product_name ?? "",
      qty: item.qty ?? 0,
      unit: item.unit ?? "шт",
      price: item.price ?? 0,
      sum: item.total_amount ?? 0,
    })),
  }));
}

/** Заказы за период: одна строка CSV = одна позиция заказа. */
export async function buildOrdersCsv(from: string, to: string, confirmedOnly: boolean) {
  const orders = await collectOrders(from, to, confirmedOnly);

  const rows: unknown[][] = [
    [
      "Номер заказа",
      "Дата заказа",
      "Статус",
      "Оплата",
      "Контрагент",
      "БИН/ИИН",
      "Контактное лицо",
      "Телефон",
      "Email",
      "Адрес доставки",
      "Дата доставки",
      "Товар",
      "Кол-во",
      "Ед.",
      "Цена",
      "Сумма строки",
      "Сумма заказа",
    ],
  ];

  for (const order of orders) {
    const base = [
      order.number,
      formatDate(order.date),
      order.status,
      order.payment,
      order.company,
      order.bin,
      order.contact,
      order.phone,
      order.email,
      order.address,
      formatDate(order.deliveryDate),
    ];

    if (order.items.length === 0) {
      rows.push([...base, "(позиции не найдены)", "", "", "", "", order.total]);
      continue;
    }

    for (const item of order.items) {
      rows.push([...base, item.name, item.qty, item.unit, item.price, item.sum, order.total]);
    }
  }

  return { csv: toCsv(rows), ordersCount: orders.length };
}

/** Клиенты сайта — заготовка справочника контрагентов. БИН берём из последнего заказа компании. */
export async function buildClientsCsv() {
  const [clients, orders] = await Promise.all([fetchAllClients(), fetchAdminOrders()]);

  const binByClientId = new Map<string, string>();
  const binByCompany = new Map<string, string>();

  for (const order of orders) {
    if (!order.customer_bin) {
      continue;
    }
    if (order.client_id && !binByClientId.has(order.client_id)) {
      binByClientId.set(order.client_id, order.customer_bin);
    }
    const company = order.company_name?.trim().toLowerCase();
    if (company && !binByCompany.has(company)) {
      binByCompany.set(company, order.customer_bin);
    }
  }

  const rows: unknown[][] = [
    [
      "Наименование",
      "БИН/ИИН",
      "Телефон",
      "Email",
      "Договор №",
      "Лимит кредита",
      "Отсрочка, дней",
      "Статус",
      "Зарегистрирован",
    ],
  ];

  for (const client of clients) {
    const bin =
      binByClientId.get(client.id) ??
      binByCompany.get(client.name.trim().toLowerCase()) ??
      "";

    rows.push([
      client.name,
      bin,
      client.phone ?? "",
      client.email ?? "",
      client.contract_no ?? "",
      client.credit_limit,
      client.payment_terms_days,
      client.status === "active" ? "Активен" : client.status === "blocked" ? "Заблокирован" : "Только предоплата",
      formatDate(client.created_at),
    ]);
  }

  return { csv: toCsv(rows), clientsCount: clients.length };
}
