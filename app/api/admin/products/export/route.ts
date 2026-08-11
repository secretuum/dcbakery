import { NextResponse } from "next/server";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { buildCatalogWorkbook } from "@/src/lib/catalog-xlsx";

// Выгрузка всего каталога в .xlsx. Доступ — сотрудникам (маршрут закрыт proxy.ts;
// GET, поэтому и торгпред может выгрузить). Правится вручную и грузится обратно.
export async function GET() {
  try {
    const products = await fetchAdminProducts();
    const buffer = await buildCatalogWorkbook(products);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dc-catalog-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сформировать выгрузку" },
      { status: 500 },
    );
  }
}
