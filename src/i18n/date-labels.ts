import type { Locale } from "@/src/i18n/config";

// Казахские короткие названия — статические строки CLDR (эталон снят из ICU Node 24:
// Intl.DateTimeFormat("kk", …)). Нужны потому, что не все браузеры/рантаймы содержат
// казахский CLDR: тогда Intl.DateTimeFormat("kk-KZ") откатывается к root-локали и
// выдаёт «M08» вместо месяца, а дни недели — АНГЛИЙСКИЕ. Для kk форматируем сами,
// для ru/en доверяем Intl (их CLDR присутствует везде).
// Индексы совпадают с Date: getDay() 0=вс…6=сб, getMonth() 0=янв…11=дек.
export const KK_WEEKDAYS_SHORT = ["жс", "дс", "сс", "ср", "бс", "жм", "сб"] as const;
export const KK_MONTHS_SHORT = [
  "қаң", "ақп", "нау", "сәу", "мам", "мау",
  "шіл", "там", "қыр", "қаз", "қар", "жел",
] as const;

export type DateLabelFormatter = {
  /** Короткий день недели: «дс» / «пн» / «Mon» */
  weekday: (date: Date) => string;
  /** День и короткий месяц: «1 там» / «1 авг» / «1 Aug» */
  day: (date: Date) => string;
};

// Форматтер подписей дат для календаря доставки. kk — по статическим массивам выше,
// ru/en — через Intl (у них короткий месяц приходит с точкой «авг.», её убираем ради
// единообразия с казахским видом без точки).
export function getDateLabelFormatter(locale: Locale): DateLabelFormatter {
  if (locale === "kk") {
    return {
      weekday: (date) => KK_WEEKDAYS_SHORT[date.getDay()] ?? "",
      day: (date) => {
        const month = KK_MONTHS_SHORT[date.getMonth()] ?? "";
        return month ? `${date.getDate()} ${month}` : String(date.getDate());
      },
    };
  }

  const intlLocale = locale === "en" ? "en-US" : "ru-RU";
  const weekdayFormat = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
  const dayFormat = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" });
  return {
    weekday: (date) => weekdayFormat.format(date),
    day: (date) => dayFormat.format(date).replace(".", ""),
  };
}

// Дата «среднего» стиля: день + короткий месяц + год.
// Порядок держим день-первый (как ru «1 авг. 2026 г.» и как календарь доставки выше) ради
// единого вида на сайте; официальный kk-CLDR-порядок иной (год-первый: «2026 ж. 01 там.»),
// но мы намеренно выбираем консистентность. kk-порядок и маркер «ж.» — кандидаты на ревью
// носителем, как и прочие kk-строки. ru/en — родной Intl dateStyle:"medium" (для kk он
// ненадёжен, см. коммент к массивам выше). Невалидная дата → "" (у Intl тут был бы throw).
export function formatMediumDate(date: Date, locale: Locale): string {
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  if (locale === "kk") {
    const month = KK_MONTHS_SHORT[date.getMonth()] ?? "";
    return `${date.getDate()} ${month}. ${date.getFullYear()} ж.`;
  }
  const intlLocale = locale === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(date);
}
