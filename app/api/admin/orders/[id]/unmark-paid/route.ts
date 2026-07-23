import { NextResponse } from "next/server";
import { getAdminEmail } from "@/src/lib/admin-identity";
import { unmarkPaid } from "@/src/lib/orders/actions";

// Снятие ошибочной отметки оплаты (этап 0 платёжного аудита).
// Разрешено только пока заказ не ушёл дальше по жизненному циклу:
// статус ровно 'paid'. Для delivering/completed — сначала вернуть статус, осознанно.

type UnmarkPaidRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: UnmarkPaidRouteProps) {
  const { id } = await params;

  try {
    const adminEmail = await getAdminEmail();
    const result = await unmarkPaid(id, { actor: { kind: "admin", email: adminEmail } });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ managerMessageId: result.managerMessageId, order: result.order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unmark payment" },
      { status: 500 },
    );
  }
}
