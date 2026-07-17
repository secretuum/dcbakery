import { NextResponse } from "next/server";
import { buildClientsCsv, buildOrdersCsv } from "@/src/lib/export-1c";

// Выгрузка для 1С (CSV). Доступ только админам — маршрут закрыт proxy.ts.
// GET /api/admin/export/1c?type=orders&from=2026-07-01&to=2026-07-17&confirmed=1
// GET /api/admin/export/1c?type=clients

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "orders";

  try {
    if (type === "clients") {
      const { csv } = await buildClientsCsv();
      return csvResponse(csv, "dc-clients-1c.csv");
    }

    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
      return NextResponse.json(
        { error: "Укажите период: from и to в формате ГГГГ-ММ-ДД" },
        { status: 400 },
      );
    }

    // Галочка в форме: отмечена → confirmed=1; снята → параметра нет (выгружаем все, кроме отменённых)
    const confirmedOnly = url.searchParams.get("confirmed") === "1";
    const { csv } = await buildOrdersCsv(from, to, confirmedOnly);

    return csvResponse(csv, `dc-orders-1c-${from}_${to}.csv`);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сформировать выгрузку" },
      { status: 500 },
    );
  }
}
