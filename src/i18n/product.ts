import type { Locale } from "@/src/i18n/config";
import type { Product } from "@/src/types";

// Локализация карточки товара: переводы приходят из catalog_product_overrides
// (заполняются конвейером генерации описаний). Нет перевода — показываем русский.

export function localizeProduct(product: Product, locale: Locale) {
  if (locale === "kk") {
    return {
      name: product.nameKk || product.name,
      description: product.descriptionKk || product.description,
      composition: product.compositionKz || product.composition,
    };
  }

  if (locale === "en") {
    return {
      name: product.nameEn || product.name,
      description: product.descriptionEn || product.description,
      composition: product.compositionEn || product.composition,
    };
  }

  return {
    name: product.name,
    description: product.description,
    composition: product.composition,
  };
}
