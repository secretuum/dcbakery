import { NextResponse } from "next/server";
import { upsertAppSetting } from "@/src/lib/supabase/admin";

const allowedSettingKeys = new Set([
  "whatsapp_bot_enabled",
  "whatsapp_customer_bot_enabled",
  "whatsapp_manager_commands_enabled",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const key = typeof payload.key === "string" ? payload.key.trim() : "";
  const value = payload.value === "false" ? "false" : payload.value === "true" ? "true" : "";

  if (!allowedSettingKeys.has(key) || !value) {
    return NextResponse.json({ error: "Invalid setting" }, { status: 400 });
  }

  try {
    const setting = await upsertAppSetting(key, value);

    if (!setting) {
      return NextResponse.json({ error: "Setting was not saved" }, { status: 500 });
    }

    return NextResponse.json({ setting });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save setting" },
      { status: 500 },
    );
  }
}
