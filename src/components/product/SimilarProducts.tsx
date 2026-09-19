import { ProductCard } from "@/src/components/catalog/ProductCard";
import { getT } from "@/src/i18n/server";
import type { Product } from "@/src/types";

type SimilarProductsProps = {
  /** Уже подобранный список (pickSimilarProducts): текущего товара тут нет. */
  products: Product[];
};

/**
 * Блок «Из этого же раздела» внизу страницы товара.
 *
 * Зачем: страница товара была листом — ни одной ссылки на другой товар, краулер
 * приходил и уходил. Карточки ведут на /{locale}/product/… (ссылку строит сама
 * ProductCard через productPath), так что раздел оказывается связан по кругу.
 *
 * Заголовок «Из этого же раздела», а не «Похожие товары»: блок показывается и
 * при одной позиции, и над одинокой карточкой «похожие» читались бы как поломка.
 *
 * priority карточкам НЕ передаём: блок живёт ниже сгиба, приоритетная загрузка
 * этих фото отбирала бы канал у главной картинки товара и била по LCP.
 */
export async function SimilarProducts({ products }: SimilarProductsProps) {
  if (products.length === 0) {
    return null;
  }

  const t = await getT();

  return (
    <section
      aria-labelledby="similar-products-heading"
      className="mx-auto max-w-7xl px-5 pb-4 lg:px-8"
    >
      <h2
        id="similar-products-heading"
        className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
      >
        {t("Из этого же раздела")}
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
