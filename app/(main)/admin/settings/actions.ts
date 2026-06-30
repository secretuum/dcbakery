"use server";

import { revalidatePath } from "next/cache";
import { upsertAppSetting } from "@/src/lib/supabase/admin";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function updateAppSettingAction(formData: FormData) {
  const key = getString(formData, "key");
  const value = getString(formData, "value");

  if (!key) {
    throw new Error("Setting key is required");
  }

  await upsertAppSetting(key, value || "false");
  revalidatePath("/admin/settings");
}
