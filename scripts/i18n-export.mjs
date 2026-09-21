// Собирает комплект для вычитки носителем языка в docs/i18n/ ИЗ ЖИВЫХ СЛОВАРЕЙ src/i18n/*.json.
//
// Зачем: словари правятся вместе с кодом, а выгрузка до 19.09.2026 собиралась руками и
// отставала — носителю уезжали строки, которых на сайте уже нет (отменённые тарифы
// доставки, старая редакция п. 7.2 оферты). Теперь комплект пересобирается командой.
//
// Запуск:  node scripts/i18n-export.mjs
//          node scripts/i18n-export.mjs --new-since=2026-09-18 --date=19.09.2026
//
// Что пишет в docs/i18n/:
//   ru.json, kk.json, en.json   — S-ключ → текст (ru — оригинал, kk/en — текущий перевод)
//   strings-translated.md       — таблица для носителя: он правит колонку «Қазақша»
//   strings-source.md           — та же таблица с пустыми переводами (чистый шаблон)
//
// Источник истины — src/i18n/kk.json и en.json (ключ словаря = русский оригинал).
// Словари НЕ правятся отсюда ни при каких условиях: выгрузка делается из них, а не наоборот.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
// Правило пометок пропусков вынесено в src/, чтобы его покрывал npm test.
import { EN_MISSING_MARK, STATUS_MISSING, STATUS_MISSING_KK, englishCell, gapOf, gapStatus } from "../src/i18n/export-status.ts";

const ROOT = process.cwd();
const DOCS = path.join(ROOT, "docs", "i18n");
const PREVIOUS = path.join(DOCS, "previous-export.json");
const EXCLUDED = path.join(DOCS, "excluded.json");

// ── аргументы ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const today = new Date();
const exportDate =
  typeof args.date === "string"
    ? args.date
    : `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

// ── разделы: путь файла, где строка встречается в коде → раздел выгрузки ──────
// Порядок важен: он же порядок разделов в файле, и по нему разрешается конфликт,
// если строка используется в нескольких местах (побеждает раздел выше).
const SECTIONS = [
  ["Шапка и подвал", [/^src\/components\/layout\//, /^app\/(\[locale\]\/)?(\(main\)\/)?layout\.tsx$/]],
  ["Главная страница", [/^app\/\[locale\]\/\(main\)\/page\.tsx$/, /^src\/components\/home\//]],
  ["Акции", [/^src\/data\/promotions\.ts$/]],
  ["Каталог и карточка товара", [/^app\/\[locale\]\/\(main\)\/(catalog|product)\//, /^src\/components\/(catalog|product)\//, /^src\/lib\/catalog\.ts$/]],
  ["Категории и подразделы каталога", [/^src\/data\/products\.ts$/]],
  ["Корзина", [/\/cart\//, /^src\/contexts\//]],
  ["Оформление заказа", [/\/checkout\//, /^src\/lib\/antifraud\//]],
  ["Успешный заказ, оплата и документы", [/\/order-success\//, /\/pay\//, /^src\/components\/(payment|documents)\//, /^app\/\(unlocalized\)\/documents\//, /^src\/lib\/documents\//]],
  ["Статусы заказов", [/^src\/lib\/order-status\.ts$/, /^src\/lib\/orders\//]],
  ["Кабинет клиента (вход, регистрация, профиль)", [/\/profile\//, /\/register\//, /^src\/components\/profile\//, /^src\/lib\/(account|registration)\//]],
  ["Контакты, «Оплата и доставка», «Оптом»", [/\/(contacts|oplata-i-dostavka|optom)\//]],
  ["Публичная оферта (страница /oferta)", [/\/oferta\//]],
  ["Политика конфиденциальности (страница /privacy)", [/\/privacy\//]],
  ["Описания страниц для поиска (title, description)", [/^src\/lib\/seo\//, /^src\/components\/seo\//]],
  ["Сообщения WhatsApp и уведомления", [/^src\/lib\/(whatsapp|telegram)\//]],
  ["Админка (видит менеджер, не клиент)", [/^app\/\(unlocalized\)\/admin\//, /^src\/components\/admin\//]],
  ["Тексты из настроек сайта (правятся в админке)", [/^src\/lib\/(site-content|home-layout)\.ts$/]],
  ["Ошибки и пустые страницы", [/\/(error|not-found|global-error)\.tsx$/]],
  ["Прочие строки интерфейса", [/.*/]],
];
const FALLBACK_SECTION = "Строки, место которых в коде не определено (тексты из настроек сайта и т. п.)";

function sectionOf(relPath) {
  for (let i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i][1].some((re) => re.test(relPath))) return i;
  }
  return SECTIONS.length - 1;
}

// ── где строка встречается в коде ────────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "app"))]
  .map((f) => path.relative(ROOT, f).split(path.sep).join("/"))
  .filter((f) => !f.startsWith("src/i18n/") && !/\.test\.tsx?$/.test(f))
  .sort();

const sources = new Map(files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]));

// Приоритет 0 — литерал внутри t("…"): точное место вызова.
// Приоритет 1 — просто встретился в файле: строка уезжает в t() переменной
// (описания разделов из src/lib/catalog.ts, массивы чипов на главной и т. п.).
const hits = new Map(); // строка → { rank, section, file, line }
function remember(text, file, index, rank) {
  const section = sectionOf(file);
  const line = sources.get(file).slice(0, index).split("\n").length;
  const prev = hits.get(text);
  const better =
    !prev ||
    rank < prev.rank ||
    (rank === prev.rank && (section < prev.section || (section === prev.section && (file < prev.file || (file === prev.file && line < prev.line)))));
  if (better) hits.set(text, { rank, section, file, line });
}

const T_CALL = /\bt\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
for (const [file, src] of sources) {
  let m;
  T_CALL.lastIndex = 0;
  while ((m = T_CALL.exec(src))) {
    const raw = m[2].replace(/\\(["'`\\])/g, "$1");
    if (raw.trim()) remember(raw, file, m.index, 0);
  }
}

// ── словари и базовая линия вычитки ──────────────────────────────────────────
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const kk = readJson(path.join(ROOT, "src/i18n/kk.json"));
const en = readJson(path.join(ROOT, "src/i18n/en.json"));
// Отменённые строки: в словарях ещё лежат, на сайте их нет — носителю не отдаём.
const excludedFile = fs.existsSync(EXCLUDED) ? readJson(EXCLUDED) : { strings: [] };
const excluded = new Map((excludedFile.strings ?? []).map((e) => [e.text, e.reason ?? ""]));
const inDictionaries = [...new Set([...Object.keys(kk), ...Object.keys(en)])];
// Строка вызывается через t(), но в словарях её нет: на казахской версии сайта она
// показывается по-русски, и без этого списка носитель о ней не узнает.
const untranslated = [...hits.keys()].filter(
  (s) => hits.get(s).rank === 0 && gapOf(s, kk, en) === "both" && !excluded.has(s),
);
const russian = [...inDictionaries.filter((s) => !excluded.has(s)), ...untranslated];
const stale = [...excluded.keys()].filter((s) => !(s in kk) && !(s in en));

const QUOTE = new Set(['"', "'", "`"]);
for (const text of russian) {
  if (hits.has(text)) continue;
  for (const [file, src] of sources) {
    // Только целый строковый литерал: иначе «шт» находится внутри «что», и строка
    // уезжает в случайный раздел.
    let idx = src.indexOf(text);
    while (idx >= 0) {
      if (QUOTE.has(src[idx - 1]) && QUOTE.has(src[idx + text.length])) {
        remember(text, file, idx, 1);
        break;
      }
      idx = src.indexOf(text, idx + 1);
    }
  }
}

// Снимок прошлой выгрузки: по нему видно, какие строки носителю уже отправляли,
// а какие появились после неё. Обновляется, когда носитель вернул файл и правки разнесены.
const previous = fs.existsSync(PREVIOUS) ? readJson(PREVIOUS) : { exported_at: null, strings: [] };
const sentEarlier = new Set(previous.strings ?? []);
const previousLabel = previous.exported_at
  ? previous.exported_at.split("-").reverse().join(".")
  : "прошлой выгрузке";

// Строки, добавленные в словарь начиная с указанной даты, — носитель их точно не видел.
const newSince = typeof args["new-since"] === "string" ? args["new-since"] : previous.highlight_since ?? null;
let addedRecently = new Set();
let newSinceLabel = "";
if (newSince) {
  try {
    const rev = execFileSync("git", ["rev-list", "-1", `--before=${newSince}`, "HEAD"], { cwd: ROOT })
      .toString()
      .trim();
    if (rev) {
      const before = JSON.parse(execFileSync("git", ["show", `${rev}:src/i18n/kk.json`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }).toString());
      addedRecently = new Set(russian.filter((s) => !(s in before)));
      newSinceLabel = newSince.split("-").reverse().join(".");
    }
  } catch (e) {
    console.warn(`! не удалось определить новые строки с ${newSince}: ${e.message}`);
  }
}

const STATUS_NEW_RECENT = newSinceLabel ? `**НОВОЕ с ${newSinceLabel}**` : "**НОВОЕ**";
const STATUS_NEW = `новое (после ${previousLabel})`;
const STATUS_SENT = `было в выгрузке ${previousLabel}`;

// Пропуск перевода важнее истории выгрузок: «было в выгрузке» при пустой казахской
// клетке прячет строку, которую носителю как раз нужно заполнить.
function statusOf(text) {
  const loud = gapStatus(gapOf(text, kk, en));
  if (loud) return loud;
  if (sentEarlier.has(text)) return STATUS_SENT;
  return addedRecently.has(text) ? STATUS_NEW_RECENT : STATUS_NEW;
}

// ── раскладка по разделам и нумерация ────────────────────────────────────────
const rows = russian.map((text) => {
  const hit = hits.get(text);
  const gap = gapOf(text, kk, en);
  return {
    ru: text,
    kk: kk[text] ?? "",
    en: en[text] ?? "",
    enCell: englishCell(gap, en[text] ?? ""),
    enMissing: gap === "both" || gap === "en",
    status: statusOf(text),
    section: hit ? SECTIONS[hit.section][0] : FALLBACK_SECTION,
    sectionIndex: hit ? hit.section : SECTIONS.length,
    file: hit?.file ?? "",
    line: hit?.line ?? 0,
  };
});

rows.sort(
  (a, b) =>
    a.sectionIndex - b.sectionIndex ||
    (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
    a.line - b.line ||
    (a.ru < b.ru ? -1 : a.ru > b.ru ? 1 : 0),
);
rows.forEach((r, i) => {
  r.key = `S${String(i + 1).padStart(3, "0")}`;
});

// --why: показать, из какого места кода выведен раздел каждой строки (для отладки правил).
if (args.why) {
  for (const r of rows) {
    console.log(`${r.key}\t${r.file || "—"}:${r.line || ""}\t${r.section}\t${r.ru.slice(0, 60)}`);
  }
}

// ── файлы ────────────────────────────────────────────────────────────────────
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

const countMissing = rows.filter((r) => r.status === STATUS_MISSING).length;
const countMissingKk = rows.filter((r) => r.status === STATUS_MISSING_KK).length;
const countMissingEn = rows.filter((r) => r.enMissing).length;
const countNewRecent = rows.filter((r) => r.status === STATUS_NEW_RECENT).length;
const countNew = rows.filter((r) => r.status === STATUS_NEW).length;
const countSent = rows.filter((r) => r.status === STATUS_SENT).length;

function buildMarkdown({ withTranslations }) {
  const out = [];
  out.push("# DC Bakery — строки интерфейса для перевода", "");
  out.push(`Дата выгрузки: ${exportDate}. Всего строк: ${rows.length}.`, "");
  out.push(
    "Собрано скриптом `scripts/i18n-export.mjs` из рабочих словарей `src/i18n/kk.json` и",
    "`src/i18n/en.json`. Здесь ровно те строки, которые сайт показывает сегодня: отменённых",
    "условий и снятых с сайта текстов в файле нет.",
    "",
  );
  out.push("## Как заполнять", "");
  out.push(
    "1. Переводите **только** колонку «Қазақша» (английскую — если попросили отдельно).",
    "2. Колонки «Ключ» и «Русский» не меняйте — по ним перевод загружают обратно.",
    "3. Если в тексте есть `${переменная}` или цифры-плейсхолдеры — оставляйте их как есть,",
    "   переводите слова вокруг.",
    "4. Вертикальная черта внутри текста экранирована как `\\|` — так её требует таблица,",
    "   в переводе пишите так же.",
    "5. Если перевод совпадает с русским (бренды, «WhatsApp», «Instagram») — оставьте как есть.",
    "6. Готовый файл пришлите обратно **целиком**.",
    "",
  );
  out.push("## Колонка «Статус» — с чего начинать", "");
  out.push(
    `- ${STATUS_MISSING} — строка на сайте есть, а перевода нет вообще: казахская версия` +
      ` показывает русский текст. Таких ${countMissing}, колонка «Қазақша» у них пустая.`,
    `- ${STATUS_MISSING_KK} — английский перевод есть, казахского нет: казахская версия` +
      ` показывает эту строку по-русски. Таких ${countMissingKk}, колонку «Қазақша» нужно заполнить.`,
    `- ${STATUS_NEW_RECENT} — строки добавлены на сайт последними и носителем ещё не смотрелись.` +
      ` Сейчас таких ${countNewRecent}. Начинать стоит с них.`,
    `- ${STATUS_NEW} — появились на сайте после прошлой выгрузки, перевод машинный.` +
      ` Таких ${countNew}, их тоже никто не проверял.`,
    `- ${STATUS_SENT} — строка входила в прошлый комплект. Таких ${countSent};` +
      " если вы их уже смотрели — перечитывать не нужно.",
    "",
    `Отметка ${EN_MISSING_MARK} в колонке «English» значит, что английского перевода нет` +
      ` (таких строк ${countMissingEn}). Для казахской вычитки это не важно — пропускайте.`,
    "",
  );
  out.push(
    "> Названия, описания и составы **товаров** сюда не входят: они лежат в базе и выгружаются",
    "> отдельно (см. `docs/i18n/README.md`).",
    "",
    "> **Оферта и политика конфиденциальности** — в последних разделах. Строки идут в порядке",
    "> появления на странице; некоторые пункты разбиты на фрагменты вокруг ссылок — переводите",
    "> фрагменты как есть. Юридическую точность перевода оферты стоит показать юристу.",
    "",
  );

  let current = null;
  for (const r of rows) {
    if (r.section !== current) {
      current = r.section;
      out.push("", `## ${current}`, "");
      out.push("| Ключ | Русский | Қазақша | English | Статус |");
      out.push("|---|---|---|---|---|");
    }
    const kkCell = withTranslations ? cell(r.kk) : "";
    const enCell = withTranslations ? cell(r.enCell) : "";
    out.push(`| ${r.key} | ${cell(r.ru)} | ${kkCell} | ${enCell} | ${r.status} |`);
  }
  out.push("");
  return out.join("\n");
}

const asMap = (pick) => Object.fromEntries(rows.map((r) => [r.key, pick(r)]));
const write = (name, data) => {
  fs.writeFileSync(path.join(DOCS, name), data);
  console.log(`  docs/i18n/${name}`);
};

console.log(`Строк в словарях: ${inDictionaries.length} (kk ${Object.keys(kk).length}, en ${Object.keys(en).length}).`);
console.log(
  `Исключено как отменённые (docs/i18n/excluded.json): ${inDictionaries.filter((s) => excluded.has(s)).length}.` +
    ` Добавлено строк из кода, которых нет в словарях: ${untranslated.length}. В выгрузке: ${rows.length}.`,
);
console.log(`Без перевода в словарях (есть в коде): ${countMissing}.`);
console.log(`Нет казахского перевода (есть английский): ${countMissingKk}. Нет английского: ${countMissingEn}.`);
for (const r of rows.filter((r) => r.status === STATUS_MISSING_KK)) console.log(`  kk — ${r.key} ${r.ru.slice(0, 80)}`);
console.log(`Статусы: ${STATUS_NEW_RECENT} — ${countNewRecent}, ${STATUS_NEW} — ${countNew}, ${STATUS_SENT} — ${countSent}.`);
console.log("Записано:");
write("ru.json", JSON.stringify(asMap((r) => r.ru), null, 2) + "\n");
write("kk.json", JSON.stringify(asMap((r) => r.kk), null, 2) + "\n");
write("en.json", JSON.stringify(asMap((r) => r.en), null, 2) + "\n");
write("strings-translated.md", buildMarkdown({ withTranslations: true }));
write("strings-source.md", buildMarkdown({ withTranslations: false }));

if (stale.length) {
  console.log(`\nУстарели записи в docs/i18n/excluded.json (этих строк в словарях уже нет, можно убрать): ${stale.length}`);
  for (const s of stale) console.log(`  — ${s.slice(0, 90)}`);
}

const lost = [...sentEarlier].filter((s) => !(s in kk) && !(s in en));
if (lost.length) {
  console.log(`\nСтрок прошлой выгрузки больше нет в словарях: ${lost.length} — сняты с сайта, в комплект не вошли.`);
}
