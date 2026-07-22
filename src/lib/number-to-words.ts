// Число прописью по-русски — для накладной формы З-2 (сумма и количество
// прописью). Учитывает род («одна тысяча», «два миллиона») и склонения
// («тысяча/тысячи/тысяч»). Проверено на образце: 33990 → «Тридцать три тысячи
// девятьсот девяносто», 39 → «Тридцать девять».

const ONES_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = [
  "", "", "двадцать", "тридцать", "сорок", "пятьдесят",
  "шестьдесят", "семьдесят", "восемьдесят", "девяносто",
];
const HUNDREDS = [
  "", "сто", "двести", "триста", "четыреста",
  "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот",
];

type PluralForms = [one: string, few: string, many: string];

function triplet(n: number, feminine: boolean): string[] {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) parts.push(HUNDREDS[h]);
  if (t > 1) {
    parts.push(TENS[t]);
    if (o) parts.push((feminine ? ONES_F : ONES_M)[o]);
  } else if (t === 1) {
    parts.push(TEENS[o]);
  } else if (o) {
    parts.push((feminine ? ONES_F : ONES_M)[o]);
  }
  return parts;
}

/** Русская форма слова по числу: [1, 2–4, 5+] с учётом 11–14. */
export function pluralRu(n: number, forms: PluralForms): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) return forms[1];
  return forms[2];
}

const SCALES: Array<[value: number, feminine: boolean, forms: PluralForms | null]> = [
  [1_000_000_000, false, ["миллиард", "миллиарда", "миллиардов"]],
  [1_000_000, false, ["миллион", "миллиона", "миллионов"]],
  [1_000, true, ["тысяча", "тысячи", "тысяч"]],
  [1, false, null],
];

/** Целое число прописью, например 33990 → «тридцать три тысячи девятьсот девяносто». */
export function numberToWordsRu(value: number): string {
  const num = Math.floor(Math.abs(value));
  if (num === 0) return "ноль";
  const words: string[] = [];
  let rest = num;
  for (const [scale, feminine, forms] of SCALES) {
    const count = Math.floor(rest / scale);
    rest %= scale;
    if (!count) continue;
    words.push(...triplet(count, feminine));
    if (forms) words.push(pluralRu(count, forms));
  }
  return words.join(" ");
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Сумма прописью в тенге для накладной: «Тридцать три тысячи … теңге 00 тиын». */
export function tengeInWords(amount: number): string {
  const tenge = Math.floor(amount);
  const tiyn = Math.round((amount - tenge) * 100);
  return `${capitalize(numberToWordsRu(tenge))} теңге ${String(tiyn).padStart(2, "0")} тиын`;
}

/** Количество прописью (целое), с заглавной буквы: 39 → «Тридцать девять». */
export function quantityInWords(qty: number): string {
  return capitalize(numberToWordsRu(qty));
}
