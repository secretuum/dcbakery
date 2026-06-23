import { NextResponse } from "next/server";
import {
  normalizeAddresses,
  saveWhatsAppClientProfile,
} from "@/src/lib/whatsapp-client-store";

type ClientRouteProps = {
  params: Promise<{
    chatId: string;
  }>;
};

function optional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseAddresses(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return normalizeAddresses(
    value
      .split(/\r?\n/)
      .map((address) => address.trim())
      .filter(Boolean),
  );
}

export async function PATCH(request: Request, { params }: ClientRouteProps) {
  const { chatId } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const addresses = parseAddresses(body.addressesText);
    const profile = await saveWhatsAppClientProfile({
      chatId,
      addresses,
      companyName: optional(body.companyName),
      customerBin: optional(body.customerBin),
      customerEmail: optional(body.customerEmail),
      customerName: optional(body.customerName),
      customerPhone: optional(body.customerPhone),
      deliveryAddress: addresses[0]?.address ?? null,
      deliveryTime: optional(body.deliveryTime),
      paymentMethod: optional(body.paymentMethod),
      primaryAddressIndex: 0,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update client" },
      { status: 500 },
    );
  }
}
