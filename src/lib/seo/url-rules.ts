// Правила адресов для поисковых роботов: что закрыто от обхода и что имеет право
// попасть в карту сайта. Функции чистые — список закрытых разделов приходит
// ПАРАМЕТРОМ, а не импортируется: единственный источник правды здесь один, это
// app/robots.ts, и вызывающий тест берёт список оттуда. Свой список закрытых
// разделов завёлся бы вторым источником правды и тихо разошёлся бы с robots.

/**
 * Путь закрыт от обхода, если какая-то запись disallow является его ПРЕФИКСОМ.
 *
 * Именно префиксом строки, а не путём по сегментам: robots.txt сопоставляет
 * записи посимвольно, поэтому «Disallow: /c» закрывает не только /c, но и
 * /catalog, и /contacts. Сравнение по сегментам выглядит аккуратнее, но врёт в
 * обе стороны: слишком широкую запись оно считает безобидной, а «/api/» —
 * закрывающей адрес «/api», хотя тот как раз остаётся открытым.
 *
 * Подстановок (* и $) в нашем robots.txt нет, поэтому и здесь их нет.
 */
export function isBlocked(pathname: string, disallow: readonly string[]): boolean {
  return disallow.some((entry) => entry && pathname.startsWith(entry));
}

/**
 * Что не так с адресом в карте сайта. Возвращает причину человеческим языком
 * (её и покажет упавший тест) или undefined, если адрес в порядке.
 *
 * Правила ровно три, и каждое лечит свою болезнь:
 *  - http:// — карта, отданная по http, для поиска указывает на ДРУГОЙ сайт,
 *    чем canonical по https: страницы раздваиваются;
 *  - www — то же самое раздвоение, только по хосту. Канонический хост у нас без www;
 *  - закрытый раздел — карта сайта зовёт робота туда, откуда robots его гонит.
 *    Противоречивые сигналы поиск разбирает не в нашу пользу.
 */
export function sitemapUrlProblem(
  url: string,
  disallow: readonly string[],
  canonicalHost: string,
): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "адрес не разбирается как URL";
  }

  if (parsed.protocol !== "https:") {
    return `адрес не по https (${parsed.protocol}//) — canonical у нас всегда https`;
  }

  if (parsed.host.startsWith("www.")) {
    return `адрес с www (${parsed.host}) — канонический хост ${canonicalHost} без www`;
  }

  if (parsed.host !== canonicalHost) {
    return `чужой хост ${parsed.host} вместо канонического ${canonicalHost}`;
  }

  if (isBlocked(parsed.pathname, disallow)) {
    return `раздел закрыт в robots.txt, в карте сайта ему не место (${parsed.pathname})`;
  }

  return undefined;
}

/** Дата lastmod: ГГГГ-ММ-ДД или полный ISO-8601. Пустая строка и «сегодня» не годятся. */
export function lastmodProblem(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return "lastmod пуст — запись без даты поиску бесполезна";
  }

  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    return `lastmod не в формате ГГГГ-ММ-ДД или ISO-8601: ${value}`;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return `lastmod не разбирается как дата: ${value}`;
  // Дата из будущего — верный признак опечатки в годе.
  if (parsed > Date.now()) return `lastmod из будущего: ${value}`;

  return undefined;
}
