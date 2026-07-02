import type { Metadata } from "next";
import Link from "next/link";
import {
  bulkUpdateCatalogProductsAction,
  updateCatalogProductAction,
} from "@/app/(main)/admin/products/actions";
import { ProductImageUpload } from "@/src/components/admin/ProductImageUpload";
import { Badge } from "@/src/components/ui/Badge";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { fetchAdminProducts, fetchCategories } from "@/src/lib/catalog";
import { formatProductPrice } from "@/src/lib/format";
import type { Product } from "@/src/types";

type AdminProductsPageProps = {
  searchParams: Promise<{
    category?: string | string[];
    q?: string | string[];
    view?: string | string[];
    created?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Товары | Админка DC Bakery",
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildProductsHref(params: { category?: string; q?: string; view?: string }) {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set("category", params.category);
  }

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.view) {
    searchParams.set("view", params.view);
  }

  const query = searchParams.toString();
  return query ? `/admin/products?${query}` : "/admin/products";
}

function filterProducts(products: Product[], categorySlug: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory = categorySlug ? product.category?.slug === categorySlug : true;
    const matchesQuery = normalizedQuery
      ? [product.name, product.description, product.subcategory, product.category?.name]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery))
      : true;

    return matchesCategory && matchesQuery;
  });
}

function getStockTone(stockQty: number) {
  if (stockQty <= 0) {
    return "text-burgundy";
  }

  if (stockQty <= 10) {
    return "text-raspberry";
  }

  return "text-dark";
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const [{ category, q, view, created }, categories, products] = await Promise.all([
    searchParams,
    fetchCategories(),
    fetchAdminProducts(),
  ]);
  const selectedCategory = getParam(category);
  const query = getParam(q);
  const selectedView = getParam(view);
  const isArchiveView = selectedView === "archive";
  const currentPoolProducts = products.filter((product) =>
    isArchiveView ? product.isArchived : !product.isArchived,
  );
  const filteredProducts = filterProducts(currentPoolProducts, selectedCategory, query);
  const totalStock = Math.round(products.reduce((sum, product) => sum + product.stock_qty, 0));
  const pricedProductsCount = products.filter((product) => product.price > 0).length;
  const archivedProductsCount = products.filter((product) => product.isArchived).length;

  return (
    <div>
      {created === "1" && (
        <div className="mb-4 rounded-xl bg-green-50 px-5 py-3 text-sm font-black text-green-700">
          Товар создан
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-raspberry">Админка</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Товары</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Каталог работает на стартовом products.ts и Supabase-правках из админки. Цена,
            остаток, название и статус здесь синхронизируются с сайтом и WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-11 items-center justify-center rounded-btn bg-coral px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-coral-hover"
          >
            Добавить товар
          </Link>
          <Link
            href="/catalog"
            className="inline-flex min-h-11 items-center justify-center rounded-btn bg-white px-4 py-2 text-sm font-black text-muted shadow-sm transition hover:bg-coral-light hover:text-dark"
          >
            Открыть каталог
          </Link>
        </div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-muted">Всего товаров</p>
          <p className="mt-2 text-3xl font-black">{products.length}</p>
        </div>
        <div className="rounded-card bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-muted">С указанной ценой</p>
          <p className="mt-2 text-3xl font-black">{pricedProductsCount}</p>
        </div>
        <div className="rounded-card bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-muted">Архив</p>
          <p className="mt-2 text-3xl font-black">{archivedProductsCount}</p>
          <p className="mt-1 text-xs font-bold text-muted">Остаток всего: {totalStock}</p>
        </div>
      </section>

      <section className="mt-6 rounded-card bg-white p-5 shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/admin/products">
          {selectedCategory ? <input type="hidden" name="category" value={selectedCategory} /> : null}
          {isArchiveView ? <input type="hidden" name="view" value="archive" /> : null}
          <input
            className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold text-dark outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/25"
            defaultValue={query}
            name="q"
            placeholder="Поиск по названию, описанию или категории"
          />
          <button
            className="min-h-12 rounded-btn bg-dark px-5 py-3 text-sm font-black text-white transition hover:bg-burgundy"
            type="submit"
          >
            Найти
          </button>
        </form>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Фильтр категорий">
          <Link
            href={buildProductsHref({ q: query, view: selectedView })}
            className={`shrink-0 rounded-btn px-4 py-2 text-sm font-black transition ${
              selectedCategory ? "bg-cream text-muted hover:bg-coral-light" : "bg-coral text-white"
            }`}
          >
            Все
          </Link>
          {categories.map((categoryItem) => {
            const isActive = selectedCategory === categoryItem.slug;

            return (
              <Link
                key={categoryItem.id}
                href={buildProductsHref({ category: categoryItem.slug, q: query, view: selectedView })}
                className={`shrink-0 rounded-btn px-4 py-2 text-sm font-black transition ${
                  isActive ? "bg-coral text-white" : "bg-cream text-muted hover:bg-coral-light"
                }`}
              >
                {categoryItem.name}
              </Link>
            );
          })}
          <Link
            href={buildProductsHref({ q: query, view: isArchiveView ? "" : "archive" })}
            className={`shrink-0 rounded-btn px-4 py-2 text-sm font-black transition ${
              isArchiveView ? "bg-dark text-white" : "bg-cream text-muted hover:bg-coral-light"
            }`}
          >
            Архив
          </Link>
        </nav>
      </section>

      <div className="mt-6 overflow-hidden rounded-card bg-white shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        {filteredProducts.length > 0 ? (
          <>
            <form
              action={bulkUpdateCatalogProductsAction}
              className="grid gap-3 border-b border-black/10 bg-cream p-4 lg:grid-cols-[1fr_auto_auto]"
              id="bulk-products"
            >
              <select
                className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                name="bulk_action"
              >
                <option value="">Массовое действие</option>
                <option value="archive">В архив</option>
                <option value="restore">Вернуть из архива</option>
                <option value="activate">Сделать активными</option>
                <option value="hide">Скрыть</option>
                <option value="set_price">Поставить цену</option>
              </select>
              <input
                className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/25"
                min="0"
                name="bulk_price"
                placeholder="Цена для выбранных"
                step="1"
                type="number"
              />
              <button
                className="min-h-11 rounded-btn bg-dark px-5 py-2 text-sm font-black text-white transition hover:bg-burgundy"
                type="submit"
              >
                Применить
              </button>
            </form>
            <div className="overflow-x-auto">
            <table className="min-w-[1260px] w-full border-collapse text-left">
              <thead className="bg-coral-light text-xs font-black uppercase text-burgundy">
                <tr>
                  <th className="px-5 py-4">Выбор</th>
                  <th className="px-5 py-4">Товар</th>
                  <th className="px-5 py-4">Категория</th>
                  <th className="px-5 py-4">Цена</th>
                  <th className="px-5 py-4">Вес</th>
                  <th className="px-5 py-4">Остаток</th>
                  <th className="px-5 py-4">Статус</th>
                  <th className="px-5 py-4">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm font-semibold">
                {filteredProducts.map((product) => {
                  const formId = `product-${product.id}`;

                  return (
                    <tr key={product.id} className="transition hover:bg-cream">
                      <td className="px-5 py-4">
                        <input
                          className="size-5 rounded border-black/20 text-coral focus:ring-coral"
                          form="bulk-products"
                          name="product_id"
                          type="checkbox"
                          value={product.id}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <form action={updateCatalogProductAction} id={formId}>
                          <input name="product_id" type="hidden" value={product.id} />
                          <input name="is_archived" type="hidden" value={String(Boolean(product.isArchived))} />
                        </form>
                        <div className="flex items-center gap-3">
                          <div className="relative size-16 shrink-0 overflow-hidden rounded-btn bg-coral-light">
                            <FallbackImage
                              alt={product.name}
                              className="object-cover"
                              fill
                              sizes="64px"
                              src={product.images[0]}
                            />
                          </div>
                          <div className="min-w-0">
                            <input
                              className="w-full min-w-64 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                              defaultValue={product.name}
                              form={formId}
                              name="name"
                            />
                            <Link
                              className="mt-1 block text-xs font-black text-raspberry transition hover:text-burgundy"
                              href={`/product/${product.slug}`}
                            >
                              /product/{product.slug}
                            </Link>
                            <input
                              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-muted outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                              defaultValue={product.slug}
                              form={formId}
                              name="slug"
                              placeholder="slug"
                            />
                            <ProductImageUpload
                              defaultValue={product.images[0] ?? ""}
                              form={formId}
                              inputName="image"
                              slug={product.slug}
                            />
                            <details className="mt-2 rounded-xl bg-cream p-3">
                              <summary className="cursor-pointer text-xs font-black text-burgundy">
                                Описание и состав
                              </summary>
                              <textarea
                                className="mt-3 min-h-24 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                                defaultValue={product.description}
                                form={formId}
                                name="description"
                                placeholder="Описание"
                              />
                              <textarea
                                className="mt-2 min-h-20 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                                defaultValue={product.composition ?? ""}
                                form={formId}
                                name="composition"
                                placeholder="Состав"
                              />
                              <textarea
                                className="mt-2 min-h-20 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                                defaultValue={product.compositionKz ?? ""}
                                form={formId}
                                name="composition_kz"
                                placeholder="Состав KZ"
                              />
                            </details>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="grid gap-2">
                          <select
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                            defaultValue={product.category?.slug ?? ""}
                            form={formId}
                            name="category_slug"
                          >
                            {categories.map((categoryItem) => (
                              <option key={categoryItem.id} value={categoryItem.slug}>
                                {categoryItem.name}
                              </option>
                            ))}
                          </select>
                          <input
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-muted outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                            defaultValue={product.subcategory ?? ""}
                            form={formId}
                            name="subcategory"
                            placeholder="Подкатегория"
                          />
                          <Badge variant="burgundy">{product.category?.name ?? "Без категории"}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className="w-32 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-raspberry outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                          defaultValue={product.price}
                          form={formId}
                          max={10000}
                          min="0"
                          name="price"
                          step="1"
                          type="number"
                        />
                        <p className="mt-1 text-xs font-bold text-muted">
                          {formatProductPrice(product.price)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="grid gap-2">
                          <input
                            className="w-36 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                            defaultValue={product.weightLabel ?? ""}
                            form={formId}
                            name="weight_label"
                            placeholder="Вес"
                          />
                          <input
                            className="w-36 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                            defaultValue={product.weightGrams ?? ""}
                            form={formId}
                            max={2000}
                            min="0"
                            name="weight_grams"
                            placeholder="Граммы"
                            step="1"
                            type="number"
                          />
                          <p className="rounded-badge bg-coral-light px-3 py-2 text-xs font-black text-coral">
                            Единица: шт
                          </p>
                        </div>
                      </td>
                      <td className={`px-5 py-4 font-black ${getStockTone(product.stock_qty)}`}>
                        <input
                          className="w-28 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                          defaultValue={product.stock_qty}
                          form={formId}
                          max={100}
                          min="0"
                          name="stock_qty"
                          step="1"
                          type="number"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="grid gap-2">
                          <select
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                            defaultValue={String(product.is_active)}
                            form={formId}
                            name="is_active"
                          >
                            <option value="true">Активен</option>
                            <option value="false">Скрыт</option>
                          </select>
                          <label className="flex items-center gap-2">
                            <span className="shrink-0 text-xs font-bold text-muted">Популярность (1–15)</span>
                            <input
                              className="w-16 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                              defaultValue={product.popularity_rank ?? ""}
                              form={formId}
                              max={15}
                              min={1}
                              name="popularity_rank"
                              step={1}
                              type="number"
                            />
                          </label>
                          <select
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                            defaultValue={String(Boolean(product.isNew))}
                            form={formId}
                            name="is_new"
                          >
                            <option value="false">Не новинка</option>
                            <option value="true">Новинка</option>
                          </select>
                          <select
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                            defaultValue={String(Boolean(product.isPromo))}
                            form={formId}
                            name="is_promo"
                          >
                            <option value="false">Не акция</option>
                            <option value="true">Акция</option>
                          </select>
                          <details className="rounded-xl bg-cream p-3">
                            <summary className="cursor-pointer text-xs font-black text-burgundy">
                              Хранение
                            </summary>
                            <input
                              className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                              defaultValue={product.shelfLife ?? ""}
                              form={formId}
                              name="shelf_life"
                              placeholder="Срок годности"
                            />
                            <input
                              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                              defaultValue={product.storage ?? ""}
                              form={formId}
                              name="storage"
                              placeholder="Хранение"
                            />
                            <input
                              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                              defaultValue={product.packageType ?? ""}
                              form={formId}
                              name="package_type"
                              placeholder="Упаковка"
                            />
                          </details>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="grid gap-2">
                          <button
                            className="min-h-10 rounded-btn bg-coral px-4 py-2 text-sm font-black text-white transition hover:bg-coral-hover"
                            form={formId}
                            name="_action"
                            type="submit"
                            value="save"
                          >
                            Сохранить
                          </button>
                          <button
                            className="min-h-10 rounded-btn bg-dark px-4 py-2 text-sm font-black text-white transition hover:bg-burgundy"
                            form={formId}
                            name="_action"
                            type="submit"
                            value={product.isArchived ? "restore" : "archive"}
                          >
                            {product.isArchived ? "Вернуть" : "В архив"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <h2 className="text-3xl font-black">Ничего не найдено</h2>
            <p className="mt-3 text-sm font-semibold text-muted">
              Измените поиск или сбросьте фильтр категории.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
