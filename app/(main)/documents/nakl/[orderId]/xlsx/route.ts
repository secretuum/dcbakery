import { NextResponse } from "next/server";
import { getCompanyDetails, hasCompleteCompanyDetails } from "@/src/lib/company-details";
import { accountGroupLabels, splitItemsByAccount } from "@/src/lib/document-split";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { buildNaklWorkbook, type NaklSection } from "@/src/lib/xlsx-docs";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";

// Скачивание накладной настоящим Excel-файлом (форма З-2).
// Доступ и условия выдачи — те же, что у печатной страницы накладной.

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  if (!isUuid(orderId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [order, items, products] = await Promise.all([
    fetchAdminOrder(orderId),
    fetchAdminOrderItems(orderId),
    fetchAdminProducts(),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const company = getCompanyDetails();
  const canIssue =
    hasCompleteCompanyDetails(company) &&
    !["pending_manager_confirmation", "new", "change_proposed", "canceled", "cancelled"].includes(
      order.status,
    );

  if (!canIssue) {
    return NextResponse.json(
      { error: "Накладная формируется после подтверждения заявки" },
      { status: 409 },
    );
  }

  const url = new URL(request.url);
  const groups = splitItemsByAccount(items, products);
  const canSplit = groups.bakery.length > 0 && groups.pf.length > 0;
  const isSplit = url.searchParams.get("split") === "1" && canSplit;

  const sections: NaklSection[] = isSplit
    ? [
        { label: accountGroupLabels.bakery, suffix: "-1", items: groups.bakery },
        { label: accountGroupLabels.pf, suffix: "-2", items: groups.pf },
      ]
    : [{ label: null, suffix: "", items }];

  const buffer = await buildNaklWorkbook(order, sections, company);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nakladnaya-${order.order_number}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
