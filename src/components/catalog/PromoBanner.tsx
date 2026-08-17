import { getCatalogPromo } from "@/src/lib/catalog-promo.server";
import { isPromoActive, almatyToday } from "@/src/lib/catalog-promo";

// Баннер акции на витрине. Серверный компонент: читает конфиг из app_settings,
// рендерится только когда акция активна. Best-effort — сбой не должен ронять страницу.
export async function PromoBanner() {
  let show = false;
  let label = "";
  try {
    const promo = await getCatalogPromo();
    if (isPromoActive(promo, almatyToday())) {
      show = true;
      label = promo.label || "Действует акция на каталог";
    }
  } catch {
    return null;
  }

  if (!show) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
      <div className="rounded-card bg-coral px-5 py-3 text-center text-sm font-bold text-white sm:text-base">
        🎉 {label}
      </div>
    </div>
  );
}
