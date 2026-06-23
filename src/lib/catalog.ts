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
    unit: sourceProduct.unit,
    weight: sourceProduct.weightLabel,
    weightLabel: sourceProduct.weightLabel,
    weightGrams: sourceProduct.weightGrams,
    shelfLife: sourceProduct.shelfLife,
    storage: sourceProduct.storage,
    packageType: sourceProduct.packageType,
    isHalal: sourceProduct.isHalal,
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
    description: override.description ?? product.description,
    images: image ? [image] : product.images,
    is_active: override.is_active ?? product.is_active,
    isNew: override.is_new ?? product.isNew,
    isPopular: override.is_popular ?? product.isPopular,
    isPromo: override.is_promo ?? product.isPromo,
    name: override.name ?? product.name,
    price: parseOverrideNumber(override.price, product.price),
    slug: override.slug ?? product.slug,
    stock_qty: parseOverrideNumber(override.stock_qty, product.stock_qty),
    subcategory: override.subcategory ?? product.subcategory,
    unit: override.unit ?? product.unit,
    weight: override.weight_label ?? product.weight,
    weightLabel: override.weight_label ?? product.weightLabel,
    updated_at: override.updated_at ?? product.updated_at,
  };
}

function getActiveCategories() {
  return productCategories.map(toCategory).filter((category) => category.is_active).sort(bySortOrder);
}

function getSourceProducts() {
  return sourceProducts.map(toProduct);
}

async function getCatalogProducts({ includeInactive = false } = {}) {
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

  return sourceCatalog
    .map((product) => applyOverride(product, overridesByProductId.get(product.id), categories))
    .filter((product) => includeInactive || (product.is_active && activeCategoryIds.has(product.category_id)))
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

export async function fetchAdminProducts(): Promise<Product[]> {
  return getCatalogProducts({ includeInactive: true });
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
