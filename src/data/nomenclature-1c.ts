// Номенклатурный номер для колонки «Номенкл. №» накладной (форма З-2).
// Ключ — slug товара (= product_id позиции заказа для товаров каталога).
//
// Приоритет: сначала настоящий код из 1С (когда товар заведён в 1С), иначе —
// временный номер из iiko с префиксом «IK» (чтобы было видно, что это iiko и что
// он временный, пока не заведут в 1С). Если нет ни того, ни другого — пусто.
//
// 1С: справочник «Номенклатура», код без ведущих нулей (в 1С «00000001253» → «1253»).
// iiko: поле num карточки (сгенерировано из .iiko-cache: price-match-report → resto-products;
//   .iiko-cache в git не входит, поэтому карта зафиксирована статически).

export const NOMENCLATURE_1C_CODES: Record<string, string> = {
  "shu-yagodnyy": "1253", // 1С: Шу ягодный
  "shu-abrikosovyy": "1252", // 1С: Шу абрикос мак
  "desert-vupi-pay": "1256", // 1С: Вупи пай
  "desert-dubayskiy": "1257", // 1С: Дубайский
  "desert-fistashka-malina": "1258", // 1С: Фисташка малина
  "denish-s-klubnikoy": "1260", // 1С: дениш клубника
  "denish-s-persikom": "1259", // 1С: дениш персик
  "merengovyy-rulet": "1151", // 1С: меренговый рулет 0,5
};

// Временные номера iiko (num). Выводятся с префиксом «IK».
export const IIKO_NUMS: Record<string, string> = {
  "pelmeni-s-govyadinoy": "98314284",
  "vareniki-s-kartofelem": "98314549",
  "kotlety-govyazhi": "98314869",
  "kotlety-kurinye": "98314376",
  "syrniki-s-irimshikom": "98313269",
  "syrniki-klassicheskie": "98314377",
  "manty-s-govyadinoy-i-tykvoy": "98314873",
  "samsa-s-govyadinoy-i-tykvoy": "98314325",
  "samsa-s-kuritsey": "98314280",
  "mini-chebureki-s-dzhusaem": "98313657",
  "mini-chebureki-s-govyazhim-farshem-i-lukom": "98313657",
  "myaso-govyadiny": "98312736",
  "farsh-govyazhiy": "98313152",
  "ribay": "98315361",
  "tibon": "98315360",
  "napoleon": "98313196",
  "medovik": "98314221",
  "molochnaya-devochka": "98314224",
  "snikers": "98314036",
  "ispanskiy-chizkeyk": "98313189",
  "tary-chizkeyk": "98313191",
  "sinnabon": "98313011",
  "kartoshka": "98313818",
  "merengovyy-rulet-tselnyy": "98313826",
  "fistashkovyy-rulet": "98313827",
  "fistashkovyy-rulet-tselnyy": "98313827",
  "tartaletka-tvorozhnaya": "98313821",
  "tartaletka-bannofi-pay": "98313289",
  "kukis": "98313382",
  "maffin-shokoladnyy": "98313482",
  "tort-medovik": "98315353",
  "tort-napoleon": "98315352",
  "tort-molochnaya-devochka": "98315351",
  "tort-snikers": "98315350",
  "banka-keyk-fistashkovyy": "98315372",
  "banka-keyk-krasnyy-barhat": "98314575",
  "banka-keyk-tiramisu": "98315371",
  "banka-keyk-oreo": "98315370",
  "molochnaya-devochka-banketnaya": "98314046",
  "tort-vuppi-banketnyy": "98315353",
};

/** Номенклатурный номер по product_id (slug): 1С-код, иначе IK+iiko, иначе "". */
export function nomenclatureCode(productId: string | null | undefined): string {
  if (!productId) return "";
  const oneC = NOMENCLATURE_1C_CODES[productId];
  if (oneC) return oneC;
  const iiko = IIKO_NUMS[productId];
  if (iiko) return `IK${iiko}`;
  return "";
}
