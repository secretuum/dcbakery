import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/Badge";
import { ProductGallery } from "@/src/components/product/ProductGallery";
import { ProductPurchase } from "@/src/components/product/ProductPurchase";
import { fetchProductBySlug, fetchProductSlugs } from "@/src/lib/catalog";
import { formatProductPrice } from "@/src/lib/format";
import { getLocale, getT } from "@/src/i18n/server";
import { withLocale, buildAlternates } from "@/src/i18n/routing";
import { localizeMeasure, localizeProduct } from "@/src/i18n/product";
import { JsonLd } from "@/src/components/seo/JsonLd";
import { SITE_URL } from "@/src/lib/site-url";

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
  const t = await getT();

  if (!product) {
    return {
      title: t("Товар не найден | DC Bakery"),
    };
  }

  const locale = await getLocale();
  const localized = localizeProduct(product, locale);
  const url = `${SITE_URL}/${locale}/product/${product.slug}`;
  const image = product.images?.[0] ? `${SITE_URL}${product.images[0]}` : undefined;

  return {
    title: `${localized.name} | DC Bakery`,
    description: localized.description,
    alternates: buildAlternates(`/product/${product.slug}`, locale),
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
  const categoryHref = withLocale(
    product.category ? `/catalog/${product.category.slug}` : "/catalog",
    locale,
  );
  // Название категории приходит русским из каталога — переводим по словарю, как в фильтрах.
  const categoryName = product.category?.name ? t(product.category.name) : t("Каталог");
  const unitLabel = t(product.unit);
  const priceText =
    product.price > 0
      ? t("${price} за ${unit}", { price: formatProductPrice(product.price), unit: unitLabel })
      : t("Цена уточняется");
  const details = [
    ["Категория", categoryName],
    ["Цена", priceText],
    ["Подкатегория", product.subcategory ? t(product.subcategory) : t("уточняется")],
    ["Минимум", `${product.min_qty} ${unitLabel}`],
    ["Остаток", `${product.stock_qty} ${unitLabel}`],
    ["Вес / фасовка", localizeMeasure(product.weightLabel, locale) || t("уточняется")],
    ["Срок годности", localizeMeasure(product.shelfLife, locale) || t("уточняется")],
    ["Хранение", localizeMeasure(product.storage, locale) || t("уточняется")],
    ["Упаковка", product.packageType ? t(product.packageType) : t("уточняется")],
  ];

  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: localized.name,
    description: localized.description,
    brand: { "@type": "Brand", name: "DC Bakery" },
    ...(product.images?.[0] ? { image: `${SITE_URL}${product.images[0]}` } : {}),
    ...(product.category?.name ? { category: categoryName } : {}),
    ...(product.price > 0
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "KZT",
            price: product.price,
            availability:
              product.stock_qty > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            url: `${SITE_URL}/${locale}/product/${product.slug}`,
            seller: { "@type": "Organization", name: "DC Bakery", url: SITE_URL },
          },
        }
      : {}),
  };

  // «Хлебные крошки» для поиска: Главная → Каталог → Категория → Товар.
  const breadcrumbJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("Главная"), item: `${SITE_URL}/${locale}/` },
      { "@type": "ListItem", position: 2, name: t("Каталог"), item: `${SITE_URL}/${locale}/catalog` },
      ...(product.category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: categoryName,
              item: `${SITE_URL}/${locale}/catalog/${product.category.slug}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: localized.name,
              item: `${SITE_URL}/${locale}/product/${product.slug}`,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 3,
              name: localized.name,
              item: `${SITE_URL}/${locale}/product/${product.slug}`,
            },
          ]),
    ],
  };

  return (
    <main className="min-h-screen bg-cream text-dark pb-24">
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-14">
        <ProductGallery images={product.images} alt={localized.name} />

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={categoryHref}
              className="rounded-badge border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-muted transition hover:bg-black/5 hover:text-dark"
            >
              {categoryName}
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
