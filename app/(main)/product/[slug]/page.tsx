import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/Badge";
import { ProductGallery } from "@/src/components/product/ProductGallery";
import { ProductPurchase } from "@/src/components/product/ProductPurchase";
import { fetchProductBySlug, fetchProductSlugs } from "@/src/lib/catalog";
import { formatProductPrice } from "@/src/lib/format";
import { getLocale, getT } from "@/src/i18n/server";
import { localizeProduct } from "@/src/i18n/product";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dc-bakery.kz").replace(/\/$/, "");

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

  const locale = await getLocale();
  const localized = localizeProduct(product, locale);
  const url = `${SITE_URL}/product/${product.slug}`;
  const image = product.images?.[0] ? `${SITE_URL}${product.images[0]}` : undefined;

  return {
    title: `${localized.name} | DC Bakery`,
    description: localized.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: localized.name,
      description: localized.description,
      url,
      siteName: "DC Bakery",
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const localized = localizeProduct(product, locale);
  const categoryHref = product.category ? `/catalog/${product.category.slug}` : "/catalog";
  const priceText =
    product.price > 0
      ? t("${price} за ${unit}", { price: formatProductPrice(product.price), unit: product.unit })
      : t("Цена уточняется");
  const details = [
    ["Категория", product.category?.name ?? t("Каталог")],
    ["Цена", priceText],
    ["Подкатегория", product.subcategory ?? t("уточняется")],
    ["Минимум", `${product.min_qty} ${product.unit}`],
    ["Остаток", `${product.stock_qty} ${product.unit}`],
    ["Вес / фасовка", product.weightLabel ?? t("уточняется")],
    ["Срок годности", product.shelfLife ?? t("уточняется")],
    ["Хранение", product.storage ?? t("уточняется")],
    ["Упаковка", product.packageType ?? t("уточняется")],
  ];

  return (
    <main className="min-h-screen bg-cream text-dark pb-24">
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-14">
        <ProductGallery images={product.images} alt={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={categoryHref}
              className="rounded-badge border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-dark"
            >
              {product.category?.name ?? t("Каталог")}
            </Link>
            <Badge variant="burgundy">B2B</Badge>
          </div>

          <h1 className="mt-5 break-words font-display text-2xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {localized.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
            {localized.description}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-card border border-black/10 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{t(label)}</p>
                <p className="mt-2 text-base font-semibold text-dark">{value}</p>
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
