import { NextResponse } from "next/server";
import { fetchAdminOrder, updateOrderAvrRequest } from "@/src/lib/supabase/admin";

type AvrRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: AvrRouteProps) {
  const { id } = await params;
  const order = await fetchAdminOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requestAvr =
    typeof payload === "object" &&
    payload !== null &&
    "requestAvr" in payload &&
    payload.requestAvr === true;

  try {
    const updatedOrder = await updateOrderAvrRequest(id, requestAvr);
    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update AVR request" },
      { status: 500 },
    );
  }
}
