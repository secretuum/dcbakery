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
  const action = getString(formData, "_action") || "save";

  if (!productId) {
    throw new Error("Product ID is required");
  }

  const isArchived = action === "archive" ? true : action === "restore" ? false : getBoolean(formData, "is_archived");

  await upsertCatalogProductOverride(productId, {
    category_slug: getString(formData, "category_slug"),
    composition: getString(formData, "composition"),
    composition_kz: getString(formData, "composition_kz"),
    description: getString(formData, "description"),
    image: getString(formData, "image"),
    is_active: getBoolean(formData, "is_active"),
    is_archived: isArchived,
    is_halal: getBoolean(formData, "is_halal"),
    is_new: getBoolean(formData, "is_new"),
    is_popular: getBoolean(formData, "is_popular"),
    is_promo: getBoolean(formData, "is_promo"),
    min_qty: getNumber(formData, "min_qty"),
    name: getString(formData, "name"),
    package_type: getString(formData, "package_type"),
    price: getNumber(formData, "price"),
    shelf_life: getString(formData, "shelf_life"),
    slug: getString(formData, "slug"),
    step_qty: getNumber(formData, "step_qty"),
    stock_qty: getNumber(formData, "stock_qty"),
    storage: getString(formData, "storage"),
    subcategory: getString(formData, "subcategory"),
    unit: getString(formData, "unit"),
    weight_grams: getNumber(formData, "weight_grams"),
    weight_label: getString(formData, "weight_label"),
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
}

export async function bulkUpdateCatalogProductsAction(formData: FormData) {
  const productIds = formData
    .getAll("product_id")
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const action = getString(formData, "bulk_action");
  const price = getNumber(formData, "bulk_price");

  if (productIds.length === 0 || !action) {
    return;
  }

  await Promise.all(
    productIds.map((productId) => {
      if (action === "archive") {
        return upsertCatalogProductOverride(productId, {
          is_active: false,
          is_archived: true,
        });
      }

      if (action === "restore") {
        return upsertCatalogProductOverride(productId, {
          is_active: true,
          is_archived: false,
        });
      }

      if (action === "activate") {
        return upsertCatalogProductOverride(productId, {
          is_active: true,
        });
      }

      if (action === "hide") {
        return upsertCatalogProductOverride(productId, {
          is_active: false,
        });
      }

      if (action === "popular") {
        return upsertCatalogProductOverride(productId, {
          is_popular: true,
        });
      }

      if (action === "not_popular") {
        return upsertCatalogProductOverride(productId, {
          is_popular: false,
        });
      }

      if (action === "set_price" && price !== null) {
        return upsertCatalogProductOverride(productId, {
          price,
        });
      }

      return Promise.resolve(null);
    }),
  );

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
}
