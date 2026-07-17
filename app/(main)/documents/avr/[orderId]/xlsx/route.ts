import { NextResponse } from "next/server";
import { getCompanyDetails, hasCompleteCompanyDetails } from "@/src/lib/company-details";
import { buildAvrWorkbook } from "@/src/lib/xlsx-docs";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";

// Скачивание АВР настоящим Excel-файлом (форма Р-1).
// Условие выдачи — как у печатной страницы: заказ завершён.

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [order, items] = await Promise.all([
    fetchAdminOrder(orderId),
    fetchAdminOrderItems(orderId),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const company = getCompanyDetails();

  if (order.status !== "completed" || !hasCompleteCompanyDetails(company)) {
    return NextResponse.json({ error: "АВР формируется после завершения заказа" }, { status: 409 });
  }

  const buffer = await buildAvrWorkbook(order, items, company);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="avr-${order.order_number}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
