import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/src/components/ui/Badge";
import { ProductGallery } from "@/src/components/product/ProductGallery";
import { ProductPurchase } from "@/src/components/product/ProductPurchase";
import { SimilarProducts } from "@/src/components/product/SimilarProducts";
import { fetchProductBySlug, fetchProductSlugs, fetchProductsByCategory } from "@/src/lib/catalog";
import { pickSimilarProducts } from "@/src/lib/similar-products";
import { formatProductPrice } from "@/src/lib/format";
import { getLocale, getT } from "@/src/i18n/server";
import { withLocale } from "@/src/i18n/routing";
import { localizeMeasure, localizeProduct } from "@/src/i18n/product";
import { JsonLd } from "@/src/components/seo/JsonLd";
import { buildPageMetadata } from "@/src/components/seo/page-metadata";
import { productMetaDescription } from "@/src/components/seo/product-description";
import { buildProductJsonLd } from "@/src/components/seo/product-jsonld";
import { getCatalogPromo } from "@/src/lib/catalog-promo.server";
import { isPromoActive, almatyToday } from "@/src/lib/catalog-promo";
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
  // Описание с запасным текстом: у части позиций описание в каталоге пустое, и
  // <meta name="description"> уходил пустым.
  const description = productMetaDescription({
    description: localized.description,
    name: localized.name,
    category: product.category?.name ? t(product.category.name) : t("Каталог"),
    t,
  });

  return {
    title: `${localized.name} | DC Bakery`,
    description,
    // Свой openGraph заменяет родительский ЦЕЛИКОМ (метаданные в Next мержатся
    // поверхностно), поэтому блок собирается общим сборщиком — он же ставит
    // og:locale, alternateLocale и twitter-картинку, которые тут терялись.
    ...buildPageMetadata({
      path: `/product/${product.slug}`,
      locale,
      title: localized.name,
      description,
      image: product.images?.[0],
    }),
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Товары раздела — для блока «Из этого же раздела» внизу страницы. Грузим в той
  // же пачке, что локаль и акцию: каталог уже в кэше, отдельного похода в базу нет.
  const [locale, t, promo, categoryProducts] = await Promise.all([
    getLocale(),
    getT(),
    getCatalogPromo(),
    product.category ? fetchProductsByCategory(product.category.slug) : Promise.resolve([]),
  ]);
  const similarProducts = pickSimilarProducts({
    products: categoryProducts,
    currentSlug: product.slug,
  });
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

  // Срок действия цены ставим ТОЛЬКО когда цена действительно акционная и у акции
  // задан последний день: oldPrice появляется у товара ровно при активной акции.
  const priceValidUntil =
    product.oldPrice && isPromoActive(promo, almatyToday()) ? promo.activeUntil : null;

  const productJsonLd = buildProductJsonLd({
    product,
    name: localized.name,
    description: productMetaDescription({
      description: localized.description,
      name: localized.name,
      category: categoryName,
      t,
    }),
    categoryName: product.category?.name ? categoryName : undefined,
    url: `${SITE_URL}/${locale}/product/${product.slug}`,
    priceValidUntil,
  });

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

      <SimilarProducts products={similarProducts} />
    </main>
  );
}
