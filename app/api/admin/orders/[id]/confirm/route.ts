import { NextResponse } from "next/server";
import { confirmOrder } from "@/src/lib/orders/actions";

type ConfirmRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: ConfirmRouteProps) {
  const { id } = await params;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  try {
    const result = await confirmOrder(id, { origin });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      order: result.order,
      managerMessageId: result.managerMessageId,
      paymentUrl: result.paymentUrl,
      registrationRequested: result.registrationRequested,
      whatsappMessageId: result.whatsappMessageId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm order" },
      { status: 500 },
    );
  }
}
