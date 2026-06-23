"use server";

import { revalidatePath } from "next/cache";
import { upsertCatalogProductOverride } from "@/src/lib/supabase/admin";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const rawValue = getString(formData, key).replace(",", ".");
  const value = Number(rawValue);

  return Number.isFinite(value) ? value : null;
}

function getBoolean(formData: FormData, key: string) {
  return getString(formData, key) === "true";
}

export async function updateCatalogProductAction(formData: FormData) {
  const productId = getString(formData, "product_id");

  if (!productId) {
    throw new Error("Product ID is required");
  }

  await upsertCatalogProductOverride(productId, {
    is_active: getBoolean(formData, "is_active"),
    is_popular: getBoolean(formData, "is_popular"),
    name: getString(formData, "name"),
    price: getNumber(formData, "price"),
    stock_qty: getNumber(formData, "stock_qty"),
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
}
