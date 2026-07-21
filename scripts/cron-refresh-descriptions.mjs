// Месячный крон (Render Cron Job): освежает кэш iiko (номенклатура + ТТК) и
// прогоняет генерацию описаний товаров в Supabase.
//
// Запуск без --force: заполняются только пустые/новые поля, уже вычитанные
// описания и ручные правки менеджера НЕ затираются (см. generate-descriptions.mjs).
//
// env берётся из process.env (Render задаёт переменные окружения), с фолбэком
// на .env.local для локального запуска. Нужны:
//   IIKO_BASE_URL, IIKO_RESTO_LOGIN, IIKO_RESTO_PASS   — фетч номенклатуры/ТТК
//   OPENAI_API_KEY (+ OPENAI_MODEL)                     — генерация описаний
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — запись overrides
//
// Кэш .iiko-cache/ в git не входит — поэтому фетч обязателен перед генерацией.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(SCRIPTS, "..");
const CACHE = resolve(SITE, ".iiko-cache");

function loadEnv() {
  const env = { ...process.env };
  const file = resolve(SITE, ".env.local");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
let base = (env.IIKO_BASE_URL ?? "").replace(/\/$/, "");
if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;

if (!base || !env.IIKO_RESTO_LOGIN || !env.IIKO_RESTO_PASS) {
  console.error("Крон: не заданы IIKO_BASE_URL / IIKO_RESTO_LOGIN / IIKO_RESTO_PASS — выход.");
  process.exit(1);
}

if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

// ── iiko resto API: номенклатура + ТТК → .iiko-cache/ ──
const sha1 = createHash("sha1").update(env.IIKO_RESTO_PASS).digest("hex");
const authRes = await fetch(
  `${base}/resto/api/auth?login=${encodeURIComponent(env.IIKO_RESTO_LOGIN)}&pass=${sha1}`,
);
const authKey = (await authRes.text()).trim();
if (!authRes.ok || !authKey || authKey.includes("<")) {
  console.error(`Крон: iiko resto auth не удался (${authRes.status}).`);
  process.exit(1);
}

try {
  const prodRes = await fetch(
    `${base}/resto/api/v2/entities/products/list?includeDeleted=false&key=${authKey}`,
  );
  if (!prodRes.ok) throw new Error(`products ${prodRes.status}`);
  const products = await prodRes.json();
  if (!Array.isArray(products) || products.length === 0) throw new Error("пустой список номенклатуры");
  writeFileSync(resolve(CACHE, "iiko-resto-products.json"), JSON.stringify(products, null, 2));
  console.log(`iiko номенклатура: ${products.length}`);

  const chartRes = await fetch(
    `${base}/resto/api/v2/assemblyCharts/getAll?dateFrom=2020-01-01&includeDeletedProducts=false&includePreparedCharts=false&key=${authKey}`,
  );
  if (!chartRes.ok) throw new Error(`assemblyCharts ${chartRes.status}`);
  const charts = await chartRes.json();
  writeFileSync(resolve(CACHE, "iiko-resto-ttk.json"), JSON.stringify(charts, null, 2));
  console.log(`iiko ТТК: ${charts?.assemblyCharts?.length ?? 0}`);
} catch (error) {
  console.error(`Крон: фетч iiko не удался — ${error.message}`);
  await fetch(`${base}/resto/api/logout?key=${authKey}`).catch(() => {});
  process.exit(1);
} finally {
  // Лицензии resto API ограничены — обязательно выходим из сессии
  await fetch(`${base}/resto/api/logout?key=${authKey}`).catch(() => {});
}

// ── генерация + запись в Supabase (без --force) ──
console.log("Запуск генерации описаний (--apply, без --force)…");
const gen = spawnSync(process.execPath, [resolve(SCRIPTS, "generate-descriptions.mjs"), "--apply"], {
  stdio: "inherit",
  cwd: SITE,
});
process.exit(gen.status ?? 1);
