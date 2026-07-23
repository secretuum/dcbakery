import { NextResponse } from "next/server";
import { getAdminEmail } from "@/src/lib/admin-identity";
import { markPaid } from "@/src/lib/orders/actions";

type MarkPaidRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: MarkPaidRouteProps) {
  const { id } = await params;

  try {
    const adminEmail = await getAdminEmail();
    const result = await markPaid(id, { actor: { kind: "admin", email: adminEmail } });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    // Идемпотентный случай (уже оплачен) — как раньше, отдаём только заказ
    if (result.noop) {
      return NextResponse.json({ order: result.order });
    }
    return NextResponse.json({ managerMessageId: result.managerMessageId, order: result.order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark order as paid" },
      { status: 500 },
    );
  }
}
