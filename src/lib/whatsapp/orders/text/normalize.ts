// Нормализация НЕДОВЕРЕННОГО пользовательского текста (сообщение или расшифровка
// голосового) для сопоставления с каталогом. Чистые функции, без сети/БД.
// Русский, казахский и латиница; опечатки/склонения гасим на уровне токенов.

/** Базовая нормализация строки: нижний регистр, ё→е, схлопывание пробелов, trim. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

// Транслитерация ЛАТИНИЦА → кириллица (клиент пишет вперемешку/транслитом).
// Правило: трогаем ТОЛЬКО латинские буквы и цифру 0; существующую кириллицу не
// портим. Многобуквенные сочетания идут ПЕРЕД однобуквенными (порядок важен).
const TRANSLIT: ReadonlyArray<[RegExp, string]> = [
  [/shch|sch/g, "щ"],
  [/sh/g, "ш"],
  [/ch/g, "ч"],
  [/ya/g, "я"],
  [/yu/g, "ю"],
  [/yo/g, "е"],
  [/zh/g, "ж"],
  [/kh/g, "х"],
  [/ts/g, "ц"],
  [/a/g, "а"],
  [/b/g, "б"],
  [/c/g, "с"],
  [/d/g, "д"],
  [/e/g, "е"],
  [/f/g, "ф"],
  [/g/g, "г"],
  [/h/g, "х"],
  [/i/g, "и"],
  [/j/g, "й"],
  [/k/g, "к"],
  [/l/g, "л"],
  [/m/g, "м"],
  [/n/g, "н"],
  [/o/g, "о"],
  [/p/g, "п"],
  [/q/g, "к"],
  [/r/g, "р"],
  [/s/g, "с"],
  [/t/g, "т"],
  [/u/g, "у"],
  [/v/g, "в"],
  [/w/g, "в"],
  [/x/g, "кс"],
  [/y/g, "ы"],
  [/z/g, "з"],
  [/0/g, "о"],
];

function transliterate(token: string): string {
  let t = token;
  for (const [re, to] of TRANSLIT) t = t.replace(re, to);
  return t;
}

// Частые окончания склонений/множественного числа (гасим только если корень ≥4).
const RU_ENDING = /(ами|ями|ов|ев|ей|ах|ях|ом|ем|ой|ый|ий|ая|яя|ое|ее|ы|и|а|я|у|е|о)$/u;

/**
 * Огрублённая форма токена для нечёткого сравнения: убираем пунктуацию, приводим
 * латиницу к кириллице, отбрасываем частые окончания. Не идеально морфологически —
 * задача лишь сблизить «сырник/сырники/сырника».
 */
export function stemToken(token: string): string {
  const cleaned = normalizeText(token).replace(/[^\p{L}\p{N}]+/gu, "");
  const t = transliterate(cleaned);
  return t.replace(RU_ENDING, (match: string, _group: string, offset: number) =>
    offset >= 4 ? "" : match,
  );
}

/** Разбить строку на нормализованные токены (без пустых). */
export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Токены в огрублённой форме (для матчинга по каталогу). */
export function stemmedTokens(input: string): string[] {
  return tokenize(input)
    .map(stemToken)
    .filter((t) => t.length > 0);
}

/** Расстояние Левенштейна (для оценки близости коротких названий). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
