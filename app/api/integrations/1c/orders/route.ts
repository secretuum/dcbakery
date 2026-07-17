import { NextResponse } from "next/server";
import { collectOrders } from "@/src/lib/export-1c";

// Эндпоинт для внешней обработки 1С: отдаёт заказы сайта в JSON.
// Авторизация: заголовок Authorization: Bearer <ONEC_EXPORT_TOKEN> (env на Render).
// 1С ходит сюда исходящим HTTPS-запросом — на сервере 1С ничего публиковать не нужно.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDateParam(date: Date) {
  const shifted = new Date(date);
  shifted.setMinutes(shifted.getMinutes() - shifted.getTimezoneOffset());
  return shifted.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const token = process.env.ONEC_EXPORT_TOKEN?.trim();

  if (!token) {
    return NextResponse.json(
      { error: "Интеграция не настроена: задайте ONEC_EXPORT_TOKEN" },
      { status: 503 },
    );
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (provided !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  let from = url.searchParams.get("from") ?? "";
  let to = url.searchParams.get("to") ?? "";

  // По умолчанию — последние 14 дней
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 14);
    from = toDateParam(start);
    to = toDateParam(now);
  }

  const confirmedOnly = url.searchParams.get("confirmed") !== "0";

  try {
    const orders = await collectOrders(from, to, confirmedOnly);

    return NextResponse.json(
      { from, to, confirmedOnly, count: orders.length, orders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось собрать заказы" },
      { status: 500 },
    );
  }
}
