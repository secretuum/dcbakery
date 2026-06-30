import {
  productCategories,
  products as sourceProducts,
  type Product as SourceProduct,
  type ProductCategory as SourceProductCategory,
} from "@/src/data/products";
import {
  fetchCatalogProductOverrides,
  type CatalogProductOverride,
} from "@/src/lib/supabase/admin";
import type { Category, Product } from "@/src/types";

function bySortOrder<T extends { sort_order: number }>(a: T, b: T) {
  return a.sort_order - b.sort_order;
}

const categoryDetails: Record<
  SourceProductCategory,
  Pick<Category, "id" | "slug" | "description" | "image" | "sort_order">
> = {
  Десерты: {
    id: "cat-desserts",
    slug: "deserty",
    description: "Порционные десерты, торты и позиции для витрины кофеен, ресторанов и магазинов.",
    image: "/product-placeholder.png",
    sort_order: 10,
  },
  Полуфабрикаты: {
    id: "cat-semi",
    slug: "polufabrikaty",
    description: "Заморозка и заготовки для стабильной кухни, быстрых завтраков и витрин.",
    image: "/product-placeholder.png",
    sort_order: 20,
  },
  Мясо: {
    id: "cat-meat",
    slug: "myaso",
    description: "Мясные позиции для меню, доставки, бизнес-ланчей и продуктовой полки.",
    image: "/product-placeholder.png",
    sort_order: 30,
  },
};

function toCategory(name: SourceProductCategory): Category {
  const details = categoryDetails[name];

  return {
    ...details,
    name,
    parent_id: null,
    is_active: true,
  };
}

function toProduct(sourceProduct: SourceProduct, index: number): Product {
  const category = toCategory(sourceProduct.category);

  return {
    id: sourceProduct.id,
    name: sourceProduct.name,
    slug: sourceProduct.slug,
    subcategory: sourceProduct.subcategory,
    description: sourceProduct.description,
    composition: sourceProduct.composition,
    compositionKz: sourceProduct.compositionKz,
    category_id: category.id,
    category,
    price: sourceProduct.price,
    unit: "шт",
    weight: sourceProduct.weightLabel,
    weightLabel: sourceProduct.weightLabel,
    weightGrams: sourceProduct.weightGrams,
    shelfLife: sourceProduct.shelfLife,
    storage: sourceProduct.storage,
    packageType: sourceProduct.packageType,
    isHalal: true,
    isArchived: false,
    isPopular: sourceProduct.isPopular,
    isNew: sourceProduct.isNew,
    isPromo: sourceProduct.isPromo,
    source: sourceProduct.source,
    notes: sourceProduct.notes,
    min_qty: 1,
    step_qty: 1,
    stock_qty: sourceProduct.stock,
    images: [sourceProduct.image],
    is_active: true,
    sort_order: index + 1,
  };
}

function parseOverrideNumber(value: CatalogProductOverride[keyof CatalogProductOverride], fallback: number) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function parseOverrideOptionalNumber(
  value: CatalogProductOverride[keyof CatalogProductOverride],
  fallback?: number,
) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function applyOverride(
  product: Product,
  override: CatalogProductOverride | undefined,
  categories: Category[],
): Product {
  if (!override) {
    return product;
  }

  const category =
    override.category_slug && categories.find((item) => item.slug === override.category_slug)
      ? categories.find((item) => item.slug === override.category_slug)
      : product.category;
  const image = override.image?.trim();

  return {
    ...product,
    category,
    category_id: category?.id ?? product.category_id,
    composition: override.composition ?? product.composition,
    compositionKz: override.composition_kz ?? product.compositionKz,
    description: override.description ?? product.description,
    images: image ? [image] : product.images,
    is_active: override.is_active ?? product.is_active,
    isArchived: override.is_archived ?? product.isArchived,
    isHalal: true,
    isNew: override.is_new ?? product.isNew,
    isPopular: override.is_popular ?? product.isPopular,
    popularity_rank: override.popularity_rank ?? product.popularity_rank,
    isPromo: override.is_promo ?? product.isPromo,
    min_qty: parseOverrideNumber(override.min_qty, product.min_qty),
    name: override.name ?? product.name,
    packageType: override.package_type ?? product.packageType,
    price: parseOverrideNumber(override.price, product.price),
    shelfLife: override.shelf_life ?? product.shelfLife,
    slug: override.slug ?? product.slug,
    step_qty: 1,
    stock_qty: parseOverrideNumber(override.stock_qty, product.stock_qty),
    storage: override.storage ?? product.storage,
    subcategory: override.subcategory ?? product.subcategory,
    unit: "шт",
    weight: override.weight_label ?? product.weight,
    weightGrams: parseOverrideOptionalNumber(override.weight_grams, product.weightGrams),
    weightLabel: override.weight_label ?? product.weightLabel,
    updated_at: override.updated_at ?? product.updated_at,
  };
}

function toCustomProduct(
  override: CatalogProductOverride,
  index: number,
  categories: Category[],
): Product | null {
  if (!override.name || !override.slug) {
    return null;
  }

  const category =
    categories.find((item) => item.slug === override.category_slug) ??
    categories[0];

  if (!category) {
    return null;
  }

  const image = override.image?.trim();

  return {
    category,
    category_id: category.id,
    composition: override.composition ?? undefined,
    compositionKz: override.composition_kz ?? undefined,
    description: override.description ?? "",
    id: override.product_id,
    images: [image || "/product-placeholder.png"],
    is_active: override.is_active ?? true,
    isArchived: override.is_archived ?? false,
    isHalal: true,
    isNew: override.is_new ?? false,
    isPopular: override.is_popular ?? false,
    popularity_rank: override.popularity_rank ?? undefined,
    isPromo: override.is_promo ?? false,
    min_qty: parseOverrideNumber(override.min_qty, 1),
    name: override.name,
    packageType: override.package_type ?? undefined,
    price: parseOverrideNumber(override.price, 0),
    shelfLife: override.shelf_life ?? undefined,
    slug: override.slug,
    sort_order: sourceProducts.length + index + 1,
    source: "admin",
    step_qty: 1,
    stock_qty: parseOverrideNumber(override.stock_qty, 0),
    storage: override.storage ?? undefined,
    subcategory: override.subcategory ?? undefined,
    unit: "шт",
    updated_at: override.updated_at ?? undefined,
    weight: override.weight_label ?? undefined,
    weightGrams: parseOverrideOptionalNumber(override.weight_grams),
    weightLabel: override.weight_label ?? undefined,
  };
}

function getActiveCategories() {
  return productCategories.map(toCategory).filter((category) => category.is_active).sort(bySortOrder);
}

function getSourceProducts() {
  return sourceProducts.map(toProduct);
}

async function getCatalogProducts({
  includeArchived = false,
  includeInactive = false,
}: {
  includeArchived?: boolean;
  includeInactive?: boolean;
} = {}) {
  const categories = getActiveCategories();
  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const sourceCatalog = getSourceProducts();
  let overrides: CatalogProductOverride[] = [];

  try {
    overrides = await fetchCatalogProductOverrides();
  } catch (error) {
    console.warn("[catalog] Failed to fetch product overrides, using static catalog:", error);
  }

  const overridesByProductId = new Map(
    overrides.map((override) => [override.product_id, override]),
  );
  const sourceProductIds = new Set(sourceCatalog.map((product) => product.id));
  const customProducts = overrides
    .filter((override) => !sourceProductIds.has(override.product_id))
    .map((override, index) => toCustomProduct(override, index, categories))
    .filter((product): product is Product => Boolean(product));

  const products = [
    ...sourceCatalog.map((product) =>
      applyOverride(product, overridesByProductId.get(product.id), categories),
    ),
    ...customProducts,
  ];

  return products
    .filter((product) => {
      if (!includeArchived && product.isArchived) {
        return false;
      }

      return includeInactive || (product.is_active && activeCategoryIds.has(product.category_id));
    })
    .sort(bySortOrder);
}

export async function fetchCategories(): Promise<Category[]> {
  return getActiveCategories();
}

export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  return getActiveCategories().find((category) => category.slug === slug) ?? null;
}

export async function fetchProducts(): Promise<Product[]> {
  return getCatalogProducts();
}

export async function fetchAdminProducts({
  includeArchived = true,
}: {
  includeArchived?: boolean;
} = {}): Promise<Product[]> {
  return getCatalogProducts({ includeArchived, includeInactive: true });
}

export async function fetchPopularProducts(limit = 4): Promise<Product[]> {
  const activeProducts = await getCatalogProducts();
  const popularProducts = activeProducts.filter((product) => product.isPopular);

  return (popularProducts.length > 0 ? popularProducts : activeProducts).slice(0, limit);
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  const category = await fetchCategoryBySlug(categorySlug);

  if (!category) {
    return [];
  }

  const products = await getCatalogProducts();

  return products.filter((product) => product.category_id === category.id);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const products = await getCatalogProducts();

  return products.find((product) => product.slug === slug) ?? null;
}

export async function fetchCategorySlugs() {
  return getActiveCategories().map((category) => ({ category: category.slug }));
}

export async function fetchProductSlugs() {
  const products = await getCatalogProducts();

  return products.map((product) => ({ slug: product.slug }));
}
