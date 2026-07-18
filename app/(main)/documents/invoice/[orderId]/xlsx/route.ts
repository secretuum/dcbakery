import { NextResponse } from "next/server";
import { getCompanyDetails, hasCompleteCompanyDetails } from "@/src/lib/company-details";
import {
  accountGroupLabels,
  splitItemsByAccount,
  sumItems,
  type AccountGroupKey,
} from "@/src/lib/document-split";
import { fetchAdminProducts } from "@/src/lib/catalog";
import { buildInvoiceWorkbook, type InvoiceSection } from "@/src/lib/xlsx-docs";
import { fetchAdminOrder, fetchAdminOrderItems } from "@/src/lib/supabase/admin";

// Скачивание счёта на оплату настоящим Excel-файлом.
// Условия выдачи и разбиение по цехам — те же, что у печатной страницы счёта.

const DEFAULT_INVOICE_VALID_DAYS = 5;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getValidDays() {
  const raw = Number(process.env.DC_INVOICE_VALID_DAYS);
  return Number.isInteger(raw) && raw > 0 && raw <= 60 ? raw : DEFAULT_INVOICE_VALID_DAYS;
}

export async function GET(
  _request: Request,
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
      { error: "Счёт формируется после подтверждения заявки" },
      { status: 409 },
    );
  }

  // Разбиение на счета по цехам — идентично странице счёта
  const groups = splitItemsByAccount(items, products);
  const ibanByGroup: Record<AccountGroupKey, string> = {
    bakery: company.bankIban,
    pf: company.bankIbanPf,
  };
  const invoices: InvoiceSection[] = (
    company.bankIbanPf && groups.pf.length > 0
      ? groups.bakery.length > 0
        ? (["bakery", "pf"] as const).map((key) => ({ key, items: groups[key] }))
        : [{ key: "pf" as const, items }]
      : [{ key: "bakery" as const, items }]
  ).map((invoice, index, list) => ({
    label: list.length > 1 ? accountGroupLabels[invoice.key] : null,
    number: list.length > 1 ? `${order.order_number}-${index + 1}` : order.order_number,
    iban: ibanByGroup[invoice.key],
    items: invoice.items,
    totalAmount: sumItems(invoice.items),
  }));

  const issuedAt = order.confirmed_at ?? order.created_at;
  const validUntil = new Date(issuedAt);
  validUntil.setDate(validUntil.getDate() + getValidDays());

  const buffer = await buildInvoiceWorkbook(order, invoices, company, {
    issuedAt,
    validUntil: validUntil.toISOString(),
    kbe: process.env.DC_KBE?.trim() || undefined,
    knp: process.env.DC_KNP?.trim() || undefined,
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="schet-${order.order_number}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
