// Зонд №4 (ТОЛЬКО ЧТЕНИЕ) — подтверждает путь для «списание заказа сайта → iiko».
// Ничего не создаёт и не меняет; секреты не выводит; обязательный logout в конце.
// Запуск: node scripts/iiko-realization-probe.mjs
//
// Что проверяет:
//   1. Какой документ списания принимает resto API (пробуем ЭКСПОРТ разных типов —
//      если тип экспортируется, значит существует и импорт того же формата).
//   2. Остатки по складам: лежат ли десерты/ПФ на «DC Bakery Десерты и полуфабрикаты».
//   3. Счета (для строки выручки акта).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(SITE, ".iiko-cache");

// Склад-кандидат под b2b (из iiko-stores.xml)
const B2B_STORE_ID = "572ff137-0f56-43da-9ddf-0d6b5d0b7d97"; // DC Bakery Десерты и полуфабрикаты

function loadEnv(file) {
  const env = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* нет файла — вернём пусто */
  }
  return env;
}

const env = loadEnv(resolve(SITE, ".env.local"));
let base = (env.IIKO_BASE_URL ?? "").replace(/\/$/, "");
if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;

if (!base || !env.IIKO_RESTO_LOGIN || !env.IIKO_RESTO_PASS) {
  console.log("IIKO_BASE_URL / IIKO_RESTO_LOGIN / IIKO_RESTO_PASS не заданы в .env.local — выходим");
  process.exit(1);
}

const sha1 = createHash("sha1").update(env.IIKO_RESTO_PASS).digest("hex");
const authRes = await fetch(
  `${base}/resto/api/auth?login=${encodeURIComponent(env.IIKO_RESTO_LOGIN)}&pass=${sha1}`,
);
const authText = (await authRes.text()).trim();
const key = authRes.ok && authText && !authText.includes("<") ? authText : null;
console.log("auth ->", authRes.status, key ? "OK" : authText.slice(0, 200));
if (!key) process.exit(1);

const today = new Date();
const to = today.toISOString().slice(0, 10);
const fromDate = new Date(today);
fromDate.setDate(fromDate.getDate() - 90);
const from = fromDate.toISOString().slice(0, 10);

async function get(label, path, saveAs) {
  const url = `${base}${path}${path.includes("?") ? "&" : "?"}key=${key}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* xml/plain */
    }
    const size = json ? (Array.isArray(json) ? `array[${json.length}]` : "json") : `${text.length}b`;
    const hint = !res.ok ? text.slice(0, 120).replace(/\s+/g, " ") : "";
    console.log(`${label} -> ${res.status} ${size} ${hint}`);
    if (res.ok && saveAs) {
      writeFileSync(resolve(OUT, saveAs), text);
      console.log("   сохранено:", saveAs);
    }
    return res.ok ? (json ?? text) : null;
  } catch (e) {
    console.log(`${label} -> FETCH ERROR: ${e.message}`);
    return null;
  }
}

try {
  console.log("\n=== 1. Какой документ списания принимает API (экспорт разных типов) ===");
  // Пробуем несколько имён — рабочий тип покажет статус 200 и структуру.
  const docTypes = [
    ["акт реализации (salesDocument)", `/resto/api/documents/export/salesDocument?from=${from}&to=${to}`, "iiko-sales-documents.xml"],
    ["акт реализации (saleDocument)", `/resto/api/documents/export/saleDocument?from=${from}&to=${to}`, null],
    ["акт списания (writeoffDocument)", `/resto/api/documents/export/writeoffDocument?from=${from}&to=${to}`, "iiko-writeoff-documents.xml"],
    ["производство (productionDocument)", `/resto/api/documents/export/productionDocument?from=${from}&to=${to}`, null],
    ["v2 документы (generic)", `/resto/api/v2/documents?dateFrom=${from}&dateTo=${to}`, "iiko-v2-documents.json"],
  ];
  for (const [label, path, saveAs] of docTypes) {
    const data = await get(label, path, saveAs);
    if (typeof data === "string") {
      const docs = [...data.matchAll(/<document>/g)].length;
      const tags = [...new Set([...data.matchAll(/<(\w+)>/g)].map((m) => m[1]))].slice(0, 25);
      if (docs) console.log(`   документов: ${docs}; теги: ${tags.join(", ")}`);
    }
  }

  console.log("\n=== 2. Остатки по складам (где лежат десерты/ПФ) ===");
  const ts = Date.now();
  // Разные версии отчёта остатков — берём ту, что ответит.
  await get("balance/stores (v2)", `/resto/api/v2/reports/balance/stores?timestamp=${ts}`, "iiko-store-balances.json");
  await get("balance/counteragents (v2)", `/resto/api/v2/reports/balance/counteragents?timestamp=${ts}`, null);
  await get("storeBalance (v1)", `/resto/api/reports/balance/stores?timestamp=${ts}`, null);
  console.log(`   (ищи в выгрузке склад ${B2B_STORE_ID} — «DC Bakery Десерты и полуфабрикаты» — и ненулевые остатки десертов/ПФ)`);

  console.log("\n=== 3. Счета (для строки выручки акта) ===");
  const accounts = await get("счета (entities Account)", `/resto/api/v2/entities/list?rootType=Account`, "iiko-accounts.json");
  if (Array.isArray(accounts)) {
    const revenue = accounts
      .filter((a) => /реализ|выручк|продаж|4\.0/i.test(`${a?.name ?? ""} ${a?.code ?? ""}`))
      .slice(0, 10)
      .map((a) => `${a.code ?? "?"} ${a.name ?? "?"} = ${a.id ?? "?"}`);
    console.log("   кандидаты счёта выручки:", revenue.length ? revenue.join(" | ") : "не нашлись — смотри iiko-accounts.json");
  }

  console.log("\n=== ИТОГ ===");
  console.log("Пришли мне из вывода: (а) какой из типов документов вернул 200 и его теги;");
  console.log("(б) есть ли на складе 572ff137 ненулевые остатки десертов/ПФ; (в) счёт выручки.");
  console.log("По этому соберу карту товаров, модуль списания и врезку в «Доставляется».");
} finally {
  await fetch(`${base}/resto/api/logout?key=${key}`).catch(() => {});
  console.log("\nlogout: done");
}
