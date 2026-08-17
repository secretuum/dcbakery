// Валидация адреса доставки. Абстракция AddressValidationProvider — чтобы позже
// подключить реальный геокодер (2GIS/Google/Yandex) БЕЗ переписывания логики.
// Сейчас платного геокодера в проекте нет, поэтому дефолт — безопасная эвристика:
// доставляем только по Алматы; при неоднозначности НЕ решаем сами, а передаём
// менеджеру (status: 'uncertain'). Чистый модуль (без сети/БД).

import { normalizeText } from "../text/normalize";

export type AddressStatus = "in_almaty" | "outside_almaty" | "uncertain";

export type AddressValidationResult = {
  status: AddressStatus;
  /** Нормализованный (для показа клиенту на подтверждение) адрес. */
  normalized: string;
  /** Распознанный город (если удалось), например «алматы» / «астана». */
  matchedCity?: string;
  /** Причина для журнала/менеджера (без сырого адреса). */
  reason: string;
  /** Координаты от геокодера (если удалось) — для точной 2ГИС-ссылки в заявке. */
  lat?: number;
  lon?: number;
};

export interface AddressValidationProvider {
  readonly name: string;
  validate(addressText: string): Promise<AddressValidationResult>;
}

// Признаки Алматы: сам город + официальные районы + узнаваемые микрорайоны.
// НЕ включаем названия улиц (Абая/Достык и т.п.) — они есть в любом городе и дали бы
// ложный in_almaty; адрес без названия города должен оставаться uncertain.
const ALMATY_MARKERS: readonly RegExp[] = [
  /алмат[ыаиуе]/,
  /almaty|almata/,
  /алмалинск/,
  /ауэзовск/,
  /бостандыкск/,
  /медеуск/,
  /наурызбайск/,
  /турксибск/,
  /жетысуск/,
  /алатауск/,
  /самал|орбита|коктем|алмагул|коктобе|калкаман|таугул|шанырак|нуркент/,
];

// Другие города Казахстана — доставка туда не осуществляется. Оставлены только
// НИЗКОколлизионные названия-города: коллизионные с улицами/словами алиасы
// (жамбыл→ул. Жамбыла, шевченко→ул. Шевченко, орал/семей/гурьев) исключены —
// при сомнении лучше uncertain→менеджер, чем ложный «не доставляем».
const OTHER_CITIES: ReadonlyArray<[RegExp, string]> = [
  [/астан[аеуы]|нур-?султан|нур\s*султан|целиноград/, "астана"],
  [/шымкент|чимкент/, "шымкент"],
  [/караганд/, "караганда"],
  [/актюбинск|актоб[ае]/, "актобе"],
  [/тараз|джамбул/, "тараз"],
  [/павлодар/, "павлодар"],
  [/усть-?каменогорск|оскемен/, "усть-каменогорск"],
  [/семипалатинск/, "семей"],
  [/костанай|кустанай/, "костанай"],
  [/кызылорд/, "кызылорда"],
  [/атырау/, "атырау"],
  [/актау/, "актау"],
  [/уральск/, "уральск"],
  [/петропавловск/, "петропавловск"],
  [/талдыкорган/, "талдыкорган"],
  [/кокшетау/, "кокшетау"],
  [/туркестан/, "туркестан"],
  [/экибастуз/, "экибастуз"],
  [/темиртау/, "темиртау"],
  [/москв|санкт-?петербург|бишкек|ташкент/, "за пределами КЗ"],
];

/**
 * Эвристический валидатор адреса без внешнего геокодера.
 * Правила: явный признак Алматы → in_almaty; явный другой город → outside_almaty;
 * иначе (адрес без города / только улица / мусор) → uncertain (передать менеджеру,
 * НЕ делаем ложный вывод про город).
 */
export class AlmatyHeuristicAddressProvider implements AddressValidationProvider {
  readonly name = "almaty-heuristic";

  async validate(addressText: string): Promise<AddressValidationResult> {
    const normalized = normalizeText(addressText);

    if (!normalized || normalized.replace(/[^\p{L}\p{N}]/gu, "").length < 4) {
      return {
        status: "uncertain",
        normalized,
        reason: "too_short_or_empty",
      };
    }

    // Явный маркер Алматы имеет приоритет (адрес «Алматы, ул. Жамбыла» — это Алматы,
    // а не Тараз): сначала проверяем Алматы, затем другие города.
    if (ALMATY_MARKERS.some((re) => re.test(normalized))) {
      return { status: "in_almaty", normalized, matchedCity: "алматы", reason: "almaty_marker" };
    }

    for (const [re, city] of OTHER_CITIES) {
      if (re.test(normalized)) {
        return { status: "outside_almaty", normalized, matchedCity: city, reason: "other_city" };
      }
    }

    // Город явно не назван — не угадываем.
    return { status: "uncertain", normalized, reason: "no_city_marker" };
  }
}
