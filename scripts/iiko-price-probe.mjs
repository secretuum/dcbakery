// Зонд №2: ищет b2b-цены в iiko — подразделения, прайс-категории,
// приказы об изменении прейскуранта, фактические цены продаж (OLAP).
// Секреты читаются из .env.local только внутри процесса и НЕ выводятся.
// Запуск: node scripts/iiko-price-probe.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(SITE, ".iiko-cache");

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv(resolve(SITE, ".env.local"));
let base = (env.IIKO_BASE_URL ?? "").replace(/\/$/, "");
if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;

if (!base || !env.IIKO_RESTO_LOGIN || !env.IIKO_RESTO_PASS) {
  console.log("IIKO_BASE_URL / IIKO_RESTO_LOGIN / IIKO_RESTO_PASS не заданы — выходим");
  process.exit(1);
}

const sha1 = createHash("sha1").update(env.IIKO_RESTO_PASS).digest("hex");
let key = null;
const authRes = await fetch(
  `${base}/resto/api/auth?login=${encodeURIComponent(env.IIKO_RESTO_LOGIN)}&pass=${sha1}`,
);
const authText = (await authRes.text()).trim();
if (authRes.ok && authText && !authText.includes("<")) key = authText;
console.log("auth ->", authRes.status, key ? "OK" : authText.slice(0, 200));
if (!key) process.exit(1);

async function probe(label, path, init, saveAs) {
  const url = `${base}${path}${path.includes("?") ? "&" : "?"}key=${key}`;
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const size = json ? (Array.isArray(json) ? `array[${json.length}]` : "json") : `${text.length}b`;
    console.log(label, "->", res.status, size, !json && res.ok ? text.slice(0, 150).replace(/\s+/g, " ") : "");
    if (res.ok && saveAs && (json || text)) {
      writeFileSync(resolve(OUT, saveAs), json ? JSON.stringify(json, null, 2) : text);
      console.log("   сохранено:", saveAs);
    }
    return json ?? (res.ok ? text : null);
  } catch (e) {
    console.log(label, "-> FETCH ERROR:", e.message);
    return null;
  }
}

try {
  // 1. Подразделения — ищем «DC b2b пекарня» (XML)
  const deps = await probe("departments", "/resto/api/corporation/departments", undefined, "iiko-departments.xml");
  if (typeof deps === "string") {
    const names = [...deps.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]);
    console.log("   подразделения:", names.join(" | "));
  }

  // 2. Прайс-категории (справочник)
  await probe("priceCategories (entities)", "/resto/api/v2/entities/list?rootType=PriceCategory", undefined, "iiko-price-categories.json");

  // 3. Кандидаты на «приказы об изменении прейскуранта» — смотрим, что вообще существует
  await probe("priceOrder v2", "/resto/api/v2/documents/priceOrder?dateFrom=2024-01-01", undefined, "iiko-price-orders.json");
  await probe("menuChange v2", "/resto/api/v2/documents/menuChange?dateFrom=2024-01-01", undefined, "iiko-menu-change.json");
  await probe("pricelist doc", "/resto/api/documents/export/pricelist?dateFrom=2024-01-01", undefined, "iiko-pricelist-doc.json");

  // 4. OLAP: какие поля есть в отчёте по продажам
  const cols = await probe("olap columns", "/resto/api/v2/reports/olap/columns?reportType=SALES", undefined, "iiko-olap-columns.json");
  if (cols && typeof cols === "object") {
    const names = Object.keys(cols);
    console.log("   olap-полей:", names.length, "| депо/цена:",
      names.filter((n) => /department|price|store|дс|dish/i.test(n)).slice(0, 20).join(", "));
  }

  // 5. OLAP: фактические цены продаж за 90 дней по подразделениям
  const body = {
    reportType: "SALES",
    buildSummary: false,
    groupByRowFields: ["Department", "DishName"],
    aggregateFields: ["DishDiscountSumInt", "DishAmountInt"],
    filters: {
      "OpenDate.Typed": { filterType: "DateRange", periodType: "CUSTOM", from: "2026-04-18", to: "2026-07-17" },
      "DeletedWithWriteoff": { filterType: "IncludeValues", values: ["NOT_DELETED"] },
      "OrderDeleted": { filterType: "IncludeValues", values: ["NOT_DELETED"] },
    },
  };
  const sales = await probe("olap sales 90d", "/resto/api/v2/reports/olap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, "iiko-olap-sales.json");
  if (sales?.data) {
    console.log("   строк продаж:", sales.data.length);
    const deps2 = [...new Set(sales.data.map((r) => r.Department))];
    console.log("   подразделения в продажах:", deps2.join(" | "));
  }
} finally {
  await fetch(`${base}/resto/api/logout?key=${key}`).catch(() => {});
  console.log("logout: done");
}
