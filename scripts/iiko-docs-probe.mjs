// Зонд №3 (только чтение): проверяет всё нужное для интеграции «заказ сайта → расходная накладная в iiko»:
// склады, контрагенты-покупатели, существующие расходные накладные (структура/формат).
// Ничего не создаёт и не меняет. Секреты из .env.local не выводятся.
// Запуск: node scripts/iiko-docs-probe.mjs
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
const authRes = await fetch(
  `${base}/resto/api/auth?login=${encodeURIComponent(env.IIKO_RESTO_LOGIN)}&pass=${sha1}`,
);
const authText = (await authRes.text()).trim();
const key = authRes.ok && authText && !authText.includes("<") ? authText : null;
console.log("auth ->", authRes.status, key ? "OK" : authText.slice(0, 200));
if (!key) process.exit(1);

function xmlNames(xml, tag = "name", limit = 30) {
  return [...xml.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, "g"))].map((m) => m[1]).slice(0, limit);
}

async function probe(label, path, saveAs) {
  const url = `${base}${path}${path.includes("?") ? "&" : "?"}key=${key}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const size = json ? (Array.isArray(json) ? `array[${json.length}]` : "json") : `${text.length}b`;
    console.log(label, "->", res.status, size, !res.ok ? text.slice(0, 150).replace(/\s+/g, " ") : "");
    if (res.ok && saveAs) {
      writeFileSync(resolve(OUT, saveAs), text);
      console.log("   сохранено:", saveAs);
    }
    return res.ok ? (json ?? text) : null;
  } catch (e) {
    console.log(label, "-> FETCH ERROR:", e.message);
    return null;
  }
}

try {
  // 1. Склады — нужен id склада для накладной
  const stores = await probe("склады", "/resto/api/corporation/stores", "iiko-stores.xml");
  if (typeof stores === "string") console.log("   склады:", xmlNames(stores).join(" | "));

  // 2. Контрагенты: поставщики точно есть в API; проверяем и варианты для покупателей
  const sup = await probe("suppliers", "/resto/api/suppliers", "iiko-suppliers.xml");
  if (typeof sup === "string") {
    const names = xmlNames(sup, "name", 500);
    console.log(`   контрагентов в suppliers: ${names.length}, примеры:`, names.slice(0, 15).join(" | "));
  }
  await probe("clients (кандидат)", "/resto/api/clients", "iiko-clients.xml");
  await probe("counteragents (кандидат)", "/resto/api/counteragents", "iiko-counteragents.xml");
  await probe("entities Counteragent (кандидат)", "/resto/api/v2/entities/list?rootType=Counteragent", "iiko-entities-counteragent.json");

  // 3. Существующие расходные накладные за 60 дней — структура, склад, формат номеров
  const from = "2026-05-18";
  const to = "2026-07-17";
  let inv = await probe(
    "расходные накладные (v1)",
    `/resto/api/documents/export/outgoingInvoice?from=${from}&to=${to}`,
    "iiko-outgoing-invoices.xml",
  );
  if (!inv) {
    inv = await probe(
      "расходные накладные (dateFrom)",
      `/resto/api/documents/export/outgoingInvoice?dateFrom=${from}&dateTo=${to}`,
      "iiko-outgoing-invoices.xml",
    );
  }
  if (typeof inv === "string") {
    const docs = [...inv.matchAll(/<document>/g)].length;
    const nums = xmlNames(inv, "documentNumber", 10);
    const agents = [...new Set(xmlNames(inv, "counteragentId", 200))].length;
    console.log(`   накладных за 60 дней: ${docs}; номера: ${nums.join(", ")}; уникальных контрагентов: ${agents}`);
  }

  // 4. Приходные для сравнения структуры (если расходных нет)
  await probe(
    "приходные накладные (для сверки формата)",
    `/resto/api/documents/export/incomingInvoice?from=${from}&to=${to}`,
    "iiko-incoming-invoices.xml",
  );
} finally {
  await fetch(`${base}/resto/api/logout?key=${key}`).catch(() => {});
  console.log("logout: done");
}
