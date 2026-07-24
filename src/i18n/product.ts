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

// Локализация «измеримых» полей карточки (фасовка, срок годности, хранение) —
// токенная замена русских единиц/слов. Числа, «грамм»/«кг» (в казахском те же)
// и °C проходят как есть. Единицы/упаковка (короткие значения) переводятся
// отдельно через t() по словарю.
const MEASURE_TOKENS: Record<"kk" | "en", ReadonlyArray<readonly [string, string]>> = {
  kk: [
    ["Хранить при ", ""],
    ["Уточнить", "Нақтылау"],
    ["мес.", "ай"],
    ["суток", "тәулік"],
    ["сутки", "тәулік"],
    ["часов", "сағат"],
    ["часа", "сағат"],
    ["шт", "дана"],
    [" по ", " "],
  ],
  en: [
    ["Хранить при ", ""],
    ["Уточнить", "To be confirmed"],
    ["грамм", "g"],
    ["кг", "kg"],
    ["мес.", "months"],
    ["суток", "days"],
    ["сутки", "days"],
    ["часов", "hours"],
    ["часа", "hours"],
    ["шт", "pcs"],
    [" по ", " × "],
  ],
};

export function localizeMeasure(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  if (locale === "ru") return value;
  let result = value;
  for (const [from, to] of MEASURE_TOKENS[locale]) {
    result = result.split(from).join(to);
  }
  return result;
}
