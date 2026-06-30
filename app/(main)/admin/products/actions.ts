"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function slugify(value: string) {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return value
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getCatalogProductPatch(formData: FormData) {
  return {
    category_slug: getString(formData, "category_slug"),
    composition: getString(formData, "composition"),
    composition_kz: getString(formData, "composition_kz"),
    description: getString(formData, "description"),
    image: getString(formData, "image"),
    is_active: getBoolean(formData, "is_active"),
    is_archived: getBoolean(formData, "is_archived"),
    is_halal: true,
    is_new: getBoolean(formData, "is_new"),
    is_popular: getBoolean(formData, "is_popular"),
    popularity_rank: getNumber(formData, "popularity_rank"),
    is_promo: getBoolean(formData, "is_promo"),
    min_qty: getNumber(formData, "min_qty"),
    name: getString(formData, "name"),
    package_type: getString(formData, "package_type"),
    price: getNumber(formData, "price"),
    shelf_life: getString(formData, "shelf_life"),
    slug: getString(formData, "slug") || slugify(getString(formData, "name")),
    step_qty: 1,
    stock_qty: getNumber(formData, "stock_qty"),
    storage: getString(formData, "storage"),
    subcategory: getString(formData, "subcategory"),
    unit: "шт",
    weight_grams: getNumber(formData, "weight_grams"),
    weight_label: getString(formData, "weight_label"),
  };
}

export async function updateCatalogProductAction(formData: FormData) {
  const productId = getString(formData, "product_id");
  const action = getString(formData, "_action") || "save";

  if (!productId) {
    throw new Error("Product ID is required");
  }

  const isArchived = action === "archive" ? true : action === "restore" ? false : getBoolean(formData, "is_archived");

  await upsertCatalogProductOverride(productId, {
    ...getCatalogProductPatch(formData),
    is_archived: isArchived,
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
}

export async function createCatalogProductAction(formData: FormData) {
  const patch = getCatalogProductPatch(formData);

  if (!patch.name || !patch.slug || !patch.category_slug) {
    throw new Error("Name, slug and category are required");
  }

  await upsertCatalogProductOverride(`custom-${crypto.randomUUID()}`, {
    ...patch,
    is_active: true,
    is_archived: false,
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  redirect("/admin/products");
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
