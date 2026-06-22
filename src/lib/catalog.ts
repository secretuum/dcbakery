import {
  productCategories,
  products as sourceProducts,
  type Product as SourceProduct,
  type ProductCategory as SourceProductCategory,
} from "@/src/data/products";
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

function getActiveCategories() {
  return productCategories.map(toCategory).filter((category) => category.is_active).sort(bySortOrder);
}

function getActiveProducts() {
  const activeCategoryIds = new Set(getActiveCategories().map((category) => category.id));

  return sourceProducts
    .map(toProduct)
    .filter((product) => product.is_active && activeCategoryIds.has(product.category_id))
    .sort(bySortOrder);
}

export async function fetchCategories(): Promise<Category[]> {
  return getActiveCategories();
}

export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  return getActiveCategories().find((category) => category.slug === slug) ?? null;
}

export async function fetchProducts(): Promise<Product[]> {
  return getActiveProducts();
}

export async function fetchPopularProducts(limit = 4): Promise<Product[]> {
  const activeProducts = getActiveProducts();
  const popularProducts = activeProducts.filter((product) => product.isPopular);

  return (popularProducts.length > 0 ? popularProducts : activeProducts).slice(0, limit);
}

export async function fetchProductsByCategory(categorySlug: string): Promise<Product[]> {
  const category = await fetchCategoryBySlug(categorySlug);

  if (!category) {
    return [];
  }

  return getActiveProducts().filter((product) => product.category_id === category.id);
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  return getActiveProducts().find((product) => product.slug === slug) ?? null;
}

export async function fetchCategorySlugs() {
  return getActiveCategories().map((category) => ({ category: category.slug }));
}

export async function fetchProductSlugs() {
  return getActiveProducts().map((product) => ({ slug: product.slug }));
}
