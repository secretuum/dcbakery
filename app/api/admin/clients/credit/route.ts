import { NextResponse } from "next/server";
import { upsertClient } from "@/src/lib/supabase/admin";
import type { Client } from "@/src/types";

type CreditPatchBody = {
  clientId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  credit_limit?: number;
  payment_terms_days?: number;
  grace_days?: number;
  price_list_id?: string | null;
  iiko_counteragent_id?: string | null;
  status?: Client["status"];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const patch: CreditPatchBody = {
    name: String(body.name).trim(),
    phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
    email: typeof body.email === "string" ? body.email.trim() || null : null,
    credit_limit: typeof body.credit_limit === "number" ? body.credit_limit : 0,
    payment_terms_days: typeof body.payment_terms_days === "number" ? body.payment_terms_days : 7,
    grace_days: typeof body.grace_days === "number" ? body.grace_days : 3,
    price_list_id: typeof body.price_list_id === "string" ? body.price_list_id || null : null,
    iiko_counteragent_id:
      typeof body.iiko_counteragent_id === "string" ? body.iiko_counteragent_id || null : null,
    status:
      body.status === "active" || body.status === "prepay_only" || body.status === "blocked"
        ? body.status
        : "active",
  };

  if (typeof body.clientId === "string" && body.clientId) {
    (patch as Record<string, unknown>).id = body.clientId;
  }

  try {
    const client = await upsertClient(patch as Parameters<typeof upsertClient>[0]);
    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save client" },
      { status: 500 },
    );
  }
}
