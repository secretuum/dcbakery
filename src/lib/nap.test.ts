import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Регрессия на единый NAP. Телефоны и адрес в оферте и политике конфиденциальности
// захардкожены намеренно: смена реквизитов в юридическом документе = новая датированная
// редакция, правкой одной строки это не делается. Тест стережёт расхождение этих литералов
// с каноном, а не «правильность» самих номеров. Канон здесь — литерал defaultSiteContent из
// src/lib/site-content.ts, то есть ловится только правка исходника. Смена номера владельцем
// через админку уходит в app_settings.site_content и кладётся поверх дефолтов на рантайме,
// исходника не касаясь: тест останется зелёным, поэтому дефолты обязаны меняться вместе с ней.
//
// ВНЕ ПЕРИМЕТРА: читаются только .tsx-исходники, а телефоны и адрес продублированы ещё и в
// src/i18n/kk.json и en.json — и в ключах, и в значениях переведённых юридических строк.
// При смене реквизитов правятся ТРИ места: .tsx, kk.json, en.json. Забытый словарь при этом
// старым номером НЕ соврёт: ключ — это вся русская строка целиком, вместе с номером внутри
// ("9.5. Контакты для претензий: … +7 747 727 2650 …"), так что правка в .tsx гарантированно
// промахивается мимо ключа, а промах в src/i18n/translate.ts возвращает исходную строку — уже
// с новым номером. Цена забытого словаря — абзац в kk/en-версии молча откатывается на русский
// (kk — язык по умолчанию, это большинство посетителей): теряется перевод, а не актуальность
// реквизитов. Соврать может только полуправка: ключ обновили, а номер внутри значения оставили
// старым — этого не ловит ни тест, ни фолбэк.

const ROOT = process.cwd(); // npm test всегда стартует из корня репо

const SITE_CONTENT = "src/lib/site-content.ts";

/** Юридические страницы: реквизиты в них литеральные и меняются только новой редакцией. */
const LEGAL_PAGES = ["app/(main)/oferta/page.tsx", "app/(main)/privacy/page.tsx"];

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// Телефон в разметке живёт в двух видах: видимый текст "+7 747 727 2650" и href "tel:+77477272650".
// Разделителем внутри номера считаем любой пробельный символ кроме перевода строки (так ловится
// и неразрывный пробел), а также дефис и скобки. Перевод строки пускать нельзя — иначе регулярка
// склеит цифры из соседних строк JSX. Ровно 11 цифр и границы по цифре отсекают ИИН/БИН
// (12 цифр), IBAN и даты.
const SEP = "(?:[^\\S\\r\\n]|[()-])*";
const PHONE_RE = new RegExp(`(?<!\\d)(?:\\+7|8|7)${SEP}(?:\\d${SEP}){10}(?!\\d)`, "g");

/** Только цифры, 8XXXXXXXXXX → 7XXXXXXXXXX: форматирование номера сравнению не мешает. */
function phoneDigits(value: string) {
  const raw = value.replace(/\D/g, "");
  return raw.length === 11 && raw.startsWith("8") ? `7${raw.slice(1)}` : raw;
}

/** Схлопывает пробелы и регистр: адрес может быть перенесён по строкам или обёрнут в t(). */
function normalizeAddress(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function findPhones(source: string) {
  return [...source.matchAll(PHONE_RE)].map((m) => m[0].trim());
}

// Канон берём из site-content.ts текстом, а не импортом: модуль начинается с `import "server-only"`,
// а этот пакет в раннере node:test не резолвится — импорт сразу падает с ошибкой
// "Cannot find package 'server-only'". Следом не поднялись бы next/cache и
// @/src/lib/supabase/admin, которых в раннере тоже нет. Регулярка по исходнику даёт то же
// значение без побочных эффектов — и по-прежнему падает, если поле переименуют или уберут.
function canonField(block: string, name: string) {
  const match = block.match(new RegExp(`${name}:\\s*"([^"]+)"`));
  assert.ok(match, `${SITE_CONTENT}: в defaultSiteContent нет поля ${name} — канон NAP читать неоткуда`);
  return match[1];
}

function canonicalNap() {
  const source = read(SITE_CONTENT);
  const block = source.match(/export const defaultSiteContent[\s\S]*?\n};/);
  assert.ok(block, `${SITE_CONTENT}: не найден блок defaultSiteContent — канон NAP читать неоткуда`);
  return {
    phones: [canonField(block[0], "contactWhatsapp"), canonField(block[0], "contactPhone")],
    address: canonField(block[0], "address"),
  };
}

// ——— канон из site-content.ts ———

test("канон NAP: телефоны и адрес вычитываются из defaultSiteContent", () => {
  // Экстрактор ломается громко: canonField и canonicalNap бросают assert, и тесты ниже краснеют.
  // Сторож нужен ради тихого случая — пробельный адрес canonField пропустит ([^"]+ допускает
  // пробел), normalizeAddress даст "", а includes("") истинно всегда: тест адреса позеленеет впустую.
  const canon = canonicalNap();
  for (const phone of canon.phones) {
    assert.match(phoneDigits(phone), /^7\d{10}$/, `не похоже на казахстанский номер: ${phone}`);
  }
  assert.ok(canon.address.trim().length > 0, "адрес в defaultSiteContent пуст");
});

// ——— телефоны в юридических документах ———

test("оферта и политика: каждый телефон совпадает с каноническим из site_content", () => {
  const canon = canonicalNap();
  const canonDigits = new Set(canon.phones.map(phoneDigits));
  const canonLabel = canon.phones.map((p) => `${p} (${phoneDigits(p)})`).join(", ");

  for (const page of LEGAL_PAGES) {
    const found = findPhones(read(page));
    // Пустой список — не «всё чисто», а «файл переписали и регрессия больше ничего не стережёт».
    assert.ok(found.length > 0, `${page}: не найдено ни одного телефона — документ переименовали или переписали?`);
    for (const phone of found) {
      assert.ok(
        canonDigits.has(phoneDigits(phone)),
        `${page}: телефон "${phone}" (${phoneDigits(phone)}) не совпадает ни с одним каноническим из ${SITE_CONTENT}: ${canonLabel}. Реквизиты разъехались — нужна новая датированная редакция документа`,
      );
    }
  }
});

test("оферта и политика: оба канонических телефона присутствуют в каждом документе", () => {
  const canon = canonicalNap();

  for (const page of LEGAL_PAGES) {
    const found = new Set(findPhones(read(page)).map(phoneDigits));
    for (const phone of canon.phones) {
      assert.ok(
        found.has(phoneDigits(phone)),
        `${page}: канонический телефон ${phone} (${phoneDigits(phone)}) в документе не найден — site_content разъехался с юридическим текстом`,
      );
    }
  }
});

// ——— адрес в юридических документах ———

test("оферта и политика: канонический адрес присутствует в каждом документе", () => {
  // Равенство «все адреса = канон» тут не годится: в оферте есть второй адрес (цех
  // полуфабрикатов), которого в SiteContent нет вовсе. Стережём присутствие канона —
  // оно и слетит, если владелец сменит адрес в site_content, а документы не перевыпустит.
  const canon = canonicalNap();
  const needle = normalizeAddress(canon.address);

  for (const page of LEGAL_PAGES) {
    assert.ok(
      normalizeAddress(read(page)).includes(needle),
      `${page}: канонический адрес "${canon.address}" из ${SITE_CONTENT} в документе не найден — реквизиты разъехались, нужна новая датированная редакция документа`,
    );
  }
});
