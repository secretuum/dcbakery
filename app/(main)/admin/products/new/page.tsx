import type { Metadata } from "next";
import Link from "next/link";
import { createCatalogProductAction } from "@/app/(main)/admin/products/actions";
import { ProductImageUpload } from "@/src/components/admin/ProductImageUpload";
import { fetchCategories } from "@/src/lib/catalog";

export const metadata: Metadata = {
  title: "Новый товар | Админка DC Bakery",
};

export default async function NewProductPage() {
  const categories = await fetchCategories();

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-raspberry">Каталог</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Новый товар</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
            После сохранения товар появится на сайте и в WhatsApp-каталоге, если он активен и не в архиве.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-btn bg-white px-4 py-2 text-sm font-black text-muted shadow-sm transition hover:bg-coral-light hover:text-dark"
          href="/admin/products"
        >
          Назад к товарам
        </Link>
      </div>

      <form
        action={createCatalogProductAction}
        className="mt-6 grid gap-5 rounded-card bg-white p-6 shadow-[0_18px_60px_rgba(120,51,38,0.10)]"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-black text-dark">
            Название
            <input
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="name"
              placeholder="Например: Шу с манго"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Slug
            <input
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="slug"
              placeholder="Можно оставить пустым"
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Категория
            <select
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="category_slug"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Подкатегория
            <input
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="subcategory"
              placeholder="Пирожные, Стейки, Заморозка"
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Цена
            <input
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              max={10000}
              min="0"
              name="price"
              step="1"
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Остаток
            <input
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              max={100}
              min="0"
              name="stock_qty"
              step="1"
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Вес на витрине
            <input
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="weight_label"
              placeholder="95 г, 1 кг, ~250 грамм"
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Граммы
            <input
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              max={2000}
              min="0"
              name="weight_grams"
              step="1"
              type="number"
            />
          </label>
          <div className="grid gap-1 text-sm font-black text-dark">
            Картинка
            <ProductImageUpload inputName="image" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-black text-dark">
            Описание
            <textarea
              className="min-h-32 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="description"
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-dark">
            Состав
            <textarea
              className="min-h-32 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="composition"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-black text-dark">
            Популярность
            <select
              className="min-h-12 rounded-xl border border-black/10 bg-cream px-4 py-3 text-sm font-bold outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
              name="is_popular"
            >
              <option value="false">Обычный</option>
              <option value="true">Популярный</option>
            </select>
          </label>
          <div className="rounded-xl bg-coral-light px-4 py-3 text-sm font-black text-coral">
            Единица заказа: шт. Вес задается отдельно для каждого товара.
          </div>
        </div>

        <button
          className="min-h-12 rounded-btn bg-coral px-5 py-3 text-sm font-black text-white transition hover:bg-coral-hover"
          type="submit"
        >
          Создать товар
        </button>
      </form>
    </div>
  );
}
