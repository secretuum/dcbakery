// Антифрод по БИН — ЧИСТОЕ ядро (без сети/сервера), покрыто тестами.
// Сеть (запрос в госреестр) живёт в company-registry.ts (связка 2) и наполняет
// CompanyRecord; здесь — только валидация БИН, нормализация/сверка названий и
// сборка вердикта для менеджера. Решение владельца: МЯГКИЙ сигнал, НЕ блок заказа.
// План и обоснование источника — docs/antifraud/bin-name-check-plan.md.

/** Тип B2B-клиента. legal=юрлицо (ТОО/АО), ip=ИП, individual=физлицо (самозанятый). */
export type CustomerType = "legal" | "ip" | "individual";

/** Требуется ли БИН/ИИН для сверки. Физлицо БИН не имеет — проверку пропускаем. */
export function requiresBin(type: CustomerType): boolean {
  return type === "legal" || type === "ip";
}

/**
 * Узкий срез записи госреестра по БИН. Наполняется провайдером (связка 2) из
 * ответа apiba.prgapp.kz; ядро зависит только от этого типа, а не от формата API.
 */
export type CompanyRecord = {
  /** false, если БИН в реестре не найден (у провайдера titleRu=null/isDeleted). */
  found: boolean;
  /** true у ИП/физлица (реестр: isIndividual) — для ИП сверку имени не флагуем. */
  isIndividual: boolean;
  titleRu: string | null;
  titleKz: string | null;
  /** «Активен» / «Бездействующий» / … (человекочитаемо, как отдаёт реестр). */
  status: string | null;
  cityName: string | null;
  addressRu: string | null;
  ceo: string | null;
  primaryOked: string | null;
  flags: {
    fakeCompany: boolean; // в списке лжепредприятий
    bankrupt: boolean; // банкрот
    inactive: boolean; // бездействующий / статус ≠ Активен
    taxDebt: boolean; // налоговая задолженность
    badGoszakup: boolean; // недобросовестный участник госзакупок
  };
  /** Сумма налоговой задолженности, ₸ (0 если нет). */
  debtTotal: number;
};

/** Ровно 12 цифр (БИН юрлица или ИИН ИП). Пробелы по краям срезаются. */
export function isValidBin(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /^\d{12}$/.test(raw.trim());
}

/** Оставить только цифры (для приведения ввода «123 456 789 012» → «123456789012»). */
export function normalizeBinInput(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

// Организационно-правовые формы, которые срезаем как отдельные токены при сверке
// названий (клиент пишет «Ромашка», реестр — ТОО "РОМАШКА"). Латиница и казахские
// формы тоже: ооо/оо/зао/оао/пао/ао/тоо/ип/чп/кх/кфх/фх/пк/тов + жшс/ақ/жк.
const LEGAL_FORM_TOKENS = new Set([
  "тоо", "ао", "оао", "зао", "пао", "оо", "ооо", "ип", "чп", "кх", "кфх", "фх", "пк", "тов",
  "жшс", "ак", "жк", "ккм",
  "llp", "jsc", "llc", "ltd", "ie", "co",
]);

/**
 * Нормализация названия для сверки: нижний регистр, ё→е, всё не буквенно-цифровое →
 * пробел, срезаем токены орг-форм, схлопываем пробелы. Латиница и кириллица остаются
 * как есть (сверка регистронезависима, но алфавиты не транслитерируем — «kaspi» и
 * «каспи» считаются разными: это осознанно, чтобы не давать ложных совпадений).
 */
export function normalizeCompanyName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .filter((token) => !LEGAL_FORM_TOKENS.has(token))
    .join(" ")
    .trim();
}

/** Порог похожести (0..1) для вердикта «fuzzy». Подбирается на реальных данных (§7 плана). */
export const NAME_FUZZY_THRESHOLD = 0.8;

export type NameMatchVerdict = "match" | "fuzzy" | "mismatch" | "unknown";
export type NameMatch = { verdict: NameMatchVerdict; score: number };

/** Расстояние Левенштейна (итеративно, O(n·m) память O(min)). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr.push(Math.min(prev[j + 1] + 1, curr[j] + 1, prev[j] + cost));
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Сверка введённого клиентом названия с официальным из реестра. Пустой любой из
 * входов → «unknown» (нечего сверять). Точное равенство нормализованных → «match».
 * Один содержит другой (подстрока, ≥3 символа) → «fuzzy». Иначе — по похожести
 * Левенштейна: ≥ порога → «fuzzy», ниже → «mismatch».
 */
export function compareCompanyNames(
  entered: string | null | undefined,
  official: string | null | undefined,
): NameMatch {
  const a = normalizeCompanyName(entered);
  const b = normalizeCompanyName(official);
  if (!a || !b) return { verdict: "unknown", score: 0 };
  if (a === b) return { verdict: "match", score: 1 };
  if ((a.length >= 3 && b.includes(a)) || (b.length >= 3 && a.includes(b))) {
    return { verdict: "fuzzy", score: 0.9 };
  }
  const score = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return { verdict: score >= NAME_FUZZY_THRESHOLD ? "fuzzy" : "mismatch", score };
}

/** «Г.АЛМАТЫ»/«Алматы» → да; «Алматинская область» → нет. null, если города нет. */
export function isAlmatyCity(cityName: string | null | undefined): boolean | null {
  if (!cityName) return null;
  const s = cityName.toLowerCase();
  if (s.includes("област")) return false; // «алматинская область» ≠ город Алматы
  return s.includes("алмат");
}

/** Итоговый вердикт для менеджера (мягкий сигнал; заказ не блокируется). */
export type BinVerdict = {
  /** Была ли выполнена содержательная проверка (физлицо/нет записи → могут быть false). */
  checked: boolean;
  /** БИН не найден в реестре (checked=true, но записи нет). */
  notFound: boolean;
  nameMatch: NameMatchVerdict;
  officialName: string | null;
  /** Красные/жёлтые флаги, человекочитаемо (для карточки менеджера). */
  redFlags: string[];
  /** true=вне Алматы, false=Алматы, null=город не известен/не проверяли. */
  cityOutsideAlmaty: boolean | null;
  /** Готовая строка для Telegram/админки. */
  summary: string;
};

/** ₸ с разделителями тысяч, для строки долга. */
function tenge(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} ₸`;
}

/**
 * Собрать вердикт по типу клиента, введённому названию и записи реестра.
 * record=null → провайдер не дал ответа (ошибка/таймаут/пропуск) → мягко «не проверено».
 * Для ИП несовпадение названия НЕ считается флагом (реестр часто хранит «ИП ФИО»,
 * а клиент вводит вывеску) — показываем справочно.
 */
export function buildBinVerdict(input: {
  customerType: CustomerType;
  enteredName: string | null | undefined;
  record: CompanyRecord | null;
}): BinVerdict {
  const { customerType, enteredName, record } = input;

  if (customerType === "individual") {
    return {
      checked: false, notFound: false, nameMatch: "unknown", officialName: null,
      redFlags: [], cityOutsideAlmaty: null,
      summary: "Физлицо (самозанятый) — БИН не проверяется.",
    };
  }

  if (!record) {
    return {
      checked: false, notFound: false, nameMatch: "unknown", officialName: null,
      redFlags: [], cityOutsideAlmaty: null,
      summary: "Проверка по БИН недоступна (реестр не ответил).",
    };
  }

  if (!record.found) {
    return {
      checked: true, notFound: true, nameMatch: "unknown", officialName: null,
      redFlags: ["🔴 БИН не найден в госреестре"], cityOutsideAlmaty: null,
      summary: "🔴 БИН не найден в госреестре — проверьте номер.",
    };
  }

  const officialName = record.titleRu ?? record.titleKz;
  const nameMatch = compareCompanyNames(enteredName, officialName).verdict;
  const cityOutsideAlmaty = ((v) => (v === null ? null : !v))(isAlmatyCity(record.cityName));

  const redFlags: string[] = [];
  if (record.flags.fakeCompany) redFlags.push("🔴 в списке лжепредприятий");
  if (record.flags.bankrupt) redFlags.push("🔴 банкрот");
  if (record.flags.inactive) redFlags.push(`🔴 недействующий/бездействующий (${record.status ?? "статус ≠ Активен"})`);
  if (record.flags.taxDebt || record.debtTotal > 0) {
    redFlags.push(`⚠ налоговая задолженность${record.debtTotal > 0 ? ` (${tenge(record.debtTotal)})` : ""}`);
  }
  if (record.flags.badGoszakup) redFlags.push("⚠ недобросовестный участник госзакупок");
  // Несовпадение названия — флаг только для юрлица (для ИП сверка ненадёжна).
  if (customerType === "legal" && nameMatch === "mismatch") {
    redFlags.push(`⚠ название не совпадает: указал «${enteredName ?? ""}», в реестре «${officialName ?? ""}»`);
  }
  if (cityOutsideAlmaty === true) redFlags.push(`⚠ адрес вне Алматы (${record.cityName ?? ""})`);

  const head = officialName ? `Реестр: «${officialName}»${record.status ? `, ${record.status}` : ""}.` : "Реестр: запись найдена.";
  const summary = redFlags.length ? `${head} ${redFlags.join("; ")}.` : `${head} Замечаний нет.`;

  return { checked: true, notFound: false, nameMatch, officialName, redFlags, cityOutsideAlmaty, summary };
}
