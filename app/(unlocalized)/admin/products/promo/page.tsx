import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogPromo } from "@/src/lib/catalog-promo.server";
import { PromoManager } from "@/src/components/admin/PromoManager";

export const metadata: Metadata = { title: "Акция каталога | Админка DC Bakery" };

export default async function PromoPage() {
  const promo = await getCatalogPromo();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/products" className="text-sm font-semibold text-coral hover:text-coral-hover">
        ← Товары
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Акция каталога</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Загрузите файл с акционными ценами — на витрине старая цена станет перечёркнутой и серой, новая
        (ниже) — яркой. Базовые цены не меняются: после акции нажмите «Выключить и очистить» (или дождитесь
        даты окончания) — цены вернутся сами.
      </p>

      <PromoManager
        initial={{
          enabled: promo.enabled,
          label: promo.label,
          activeUntil: promo.activeUntil,
          count: Object.keys(promo.prices).length,
        }}
      />
    </div>
  );
}
