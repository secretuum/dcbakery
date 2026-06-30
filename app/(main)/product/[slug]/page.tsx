import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/Badge";
import { ProductGallery } from "@/src/components/product/ProductGallery";
import { ProductPurchase } from "@/src/components/product/ProductPurchase";
import { fetchProductBySlug, fetchProductSlugs } from "@/src/lib/catalog";
import { formatProductPrice } from "@/src/lib/format";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return fetchProductSlugs();
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: "Товар не найден | DC Bakery",
    };
  }

  return {
    title: `${product.name} | DC Bakery`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const categoryHref = product.category ? `/catalog/${product.category.slug}` : "/catalog";
  const priceText =
    product.price > 0 ? `${formatProductPrice(product.price)} за ${product.unit}` : "Цена уточняется";
  const details = [
    ["Категория", product.category?.name ?? "Каталог"],
    ["Цена", priceText],
    ["Подкатегория", product.subcategory ?? "уточняется"],
    ["Минимум", `${product.min_qty} ${product.unit}`],
    ["Остаток", `${product.stock_qty} ${product.unit}`],
    ["Вес / фасовка", product.weightLabel ?? "уточняется"],
    ["Срок годности", product.shelfLife ?? "уточняется"],
    ["Хранение", product.storage ?? "уточняется"],
    ["Упаковка", product.packageType ?? "уточняется"],
  ];

  return (
    <main className="min-h-screen bg-cream text-dark">
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-14">
        <ProductGallery images={product.images} alt={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={categoryHref}
              className="rounded-badge bg-white px-3 py-1 text-xs font-black text-muted shadow-sm transition hover:bg-coral-light hover:text-dark"
            >
              {product.category?.name ?? "Каталог"}
            </Link>
            <Badge variant="burgundy">B2B</Badge>
          </div>

          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight sm:text-6xl">
            {product.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-muted">
            {product.description}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-card bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase text-muted">{label}</p>
                <p className="mt-2 text-lg font-black text-dark">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <ProductPurchase product={product} />
          </div>
        </div>
      </section>
    </main>
  );
}
