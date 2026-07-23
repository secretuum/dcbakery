import { NextResponse } from "next/server";
import { cancelOrderAction } from "@/src/lib/orders/actions";

type CancelRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: CancelRouteProps) {
  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    const result = await cancelOrderAction(id, { reason: payload.reason });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ managerMessageId: result.managerMessageId, order: result.order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order" },
      { status: 500 },
    );
  }
}
