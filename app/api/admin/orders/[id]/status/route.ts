import { NextResponse } from "next/server";
import { changeStatus } from "@/src/lib/orders/actions";

type StatusRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: StatusRouteProps) {
  const { id } = await params;
  const payload = (await request.json()) as { status?: string };

  try {
    const result = await changeStatus(id, payload.status ?? "");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ managerMessageId: result.managerMessageId, order: result.order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order" },
      { status: 500 },
    );
  }
}
