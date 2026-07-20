import { NextResponse } from "next/server";
import { collectClients } from "@/src/lib/export-1c";

// Эндпоинт для внешней обработки 1С: отдаёт зарегистрированных клиентов сайта
// в JSON, чтобы обработка создавала контрагентов сразу после регистрации,
// не дожидаясь первого заказа. id клиента — ключ связки аккаунт ↔ контрагент.
// Авторизация: заголовок Authorization: Bearer <ONEC_EXPORT_TOKEN> (env на Render).

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

  try {
    const clients = await collectClients();

    return NextResponse.json(
      { count: clients.length, clients },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось собрать клиентов" },
      { status: 500 },
    );
  }
}
