import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { SITE_CONTENT_KEY } from "@/src/lib/site-content";
import { HOME_LAYOUT_KEY } from "@/src/lib/home-layout";
import { getIsSuperAdmin } from "@/src/lib/superadmin";
import { upsertAppSetting } from "@/src/lib/supabase/admin";

const allowedSettingKeys = new Set([
  "whatsapp_bot_enabled",
  "whatsapp_customer_bot_enabled",
  "whatsapp_manager_commands_enabled",
]);

const MAX_SITE_CONTENT_LENGTH = 20_000;
// Раскладка главной хранит URL картинок → допускаем больший объём.
const MAX_HOME_LAYOUT_LENGTH = 100_000;

// JSON-настройки суперадмина: ключ → максимальная длина строки.
const jsonSettingKeys: Record<string, number> = {
  [SITE_CONTENT_KEY]: MAX_SITE_CONTENT_LENGTH,
  [HOME_LAYOUT_KEY]: MAX_HOME_LAYOUT_LENGTH,
};

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

  // JSON-настройки сайта (контент/раскладка главной): только для суперадмина
  if (key in jsonSettingKeys) {
    const value = typeof payload.value === "string" ? payload.value : "";

    if (!value || value.length > jsonSettingKeys[key]) {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }

    try {
      JSON.parse(value);
    } catch {
      return NextResponse.json({ error: "Content must be valid JSON" }, { status: 400 });
    }

    if (!(await getIsSuperAdmin())) {
      return NextResponse.json({ error: "Superadmin only" }, { status: 403 });
    }

    try {
      const setting = await upsertAppSetting(key, value);

      if (!setting) {
        return NextResponse.json({ error: "Setting was not saved" }, { status: 500 });
      }

      revalidatePath("/", "layout");
      return NextResponse.json({ setting });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to save setting" },
        { status: 500 },
      );
    }
  }

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
