"use server";

import { revalidatePath } from "next/cache";
import { clearProductStop } from "@/src/lib/supabase/admin";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function clearStopListItemAction(formData: FormData) {
  const productId = getString(formData, "product_id");

  if (!productId) {
    throw new Error("Product ID is required");
  }

  await clearProductStop(productId);
  revalidatePath("/", "layout");
  revalidatePath("/admin/stop-list");
  revalidatePath("/admin/products");
}
