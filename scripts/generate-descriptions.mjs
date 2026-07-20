// Конвейер описаний товаров: iiko ТТК → OpenAI → составы (рус/каз), описания
// (рус/каз/англ) и переводы названий (каз/англ) → catalog_product_overrides.
//
// Запуск (секреты читаются из .env.local, наружу не выводятся):
//   node scripts/generate-descriptions.mjs            — прогон без записи (dry-run),
//                                                       результат в .iiko-cache/generated-content.json
//   node scripts/generate-descriptions.mjs --apply    — записать в Supabase
//   node scripts/generate-descriptions.mjs --apply --force
//       по умолчанию description/composition НЕ перезаписываются, если менеджер
//       уже заполнил их в админке; --force перезаписывает и их
//   node scripts/generate-descriptions.mjs --only=napoleon,medovik — только эти slug'и
//   node scripts/generate-descriptions.mjs --limit=5  — первые N товаров (для пробы)
//
// Требует в .env.local: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Модель: OPENAI_MODEL (по умолчанию gpt-4o-mini).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = resolve(SITE, ".iiko-cache");
const OUT_FILE = resolve(CACHE, "generated-content.json");

// ── Аргументы ──
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(",").map((s) => s.trim())) : null;
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.slice(8)) : Infinity;

// ── env ──
function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv(resolve(SITE, ".env.local"));
const OPENAI_KEY = env.OPENAI_API_KEY;
const MODEL = env.OPENAI_MODEL || "gpt-4o-mini";
const SB_URL = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_KEY) {
  console.log("OPENAI_API_KEY не задан в .env.local — выходим");
  process.exit(1);
}
if (APPLY && (!SB_URL || !SB_KEY)) {
  console.log("Supabase-креды не заданы — --apply невозможен");
  process.exit(1);
}

// ── Товары сайта из products.ts ──
const src = readFileSync(resolve(SITE, "src/data/products.ts"), "utf8");
const products = [];
for (const m of src.matchAll(/\{\s*"id":[\s\S]*?\n  \}/g)) {
  try {
    const o = JSON.parse(m[0]);
    products.push(o);
  } catch {}
}
for (const m of src.matchAll(/\{ num: (\d+), composition: "([^"]*)", weightGrams: (\d+), price: (\d+) \}/g)) {
  const num = Number(m[1]);
  products.push({
    id: `lanch-boks-${num}`,
    slug: `lanch-boks-${num}`,
    name: `Ланч бокс ${num}`,
    category: "Готовые обеды",
    subcategory: "Ланч-боксы",
    description: m[2],
    composition: m[2],
    weightLabel: `~${m[3]} грамм`,
  });
}
console.log(`товаров сайта: ${products.length}`);

// ── iiko: номенклатура и ТТК ──
const nomenclature = JSON.parse(readFileSync(resolve(CACHE, "iiko-resto-products.json"), "utf8"));
const ttk = JSON.parse(readFileSync(resolve(CACHE, "iiko-resto-ttk.json"), "utf8"));
const byId = new Map(nomenclature.map((p) => [p.id, p]));

// Актуальная ТТК по продукту: без dateTo (или dateTo в будущем), самая свежая
const today = new Date().toISOString().slice(0, 10);
const chartsByProduct = new Map();
for (const chart of ttk.assemblyCharts ?? []) {
  if (chart.dateTo && chart.dateTo < today) continue;
  const existing = chartsByProduct.get(chart.assembledProductId);
  if (!existing || (chart.dateFrom ?? "") > (existing.dateFrom ?? "")) {
    chartsByProduct.set(chart.assembledProductId, chart);
  }
}
console.log(`актуальных ТТК: ${chartsByProduct.size}`);

// ── Матчинг сайт → кандидаты iiko (та же логика, что в сверке цен) ──
function normalize(raw) {
  let s = raw.toLowerCase().replace(/ё/g, "е");
  s = s.replace(/\|-+>?\s*вынос/g, " ");
  s = s.replace(/^\s*(опт|в2в|b2b|каспи|чоко|тв|г\/п|п\/ф|пф|п\\ф|к|витрина|магазин|акция)\s+/i, "");
  s = s.replace(/\s+(дс|зал|витрина)\s*\**\s*$/i, " ");
  s = s.replace(/^\s*[-*]+\s*/, "").replace(/\*+/g, " ");
  s = s.replace(/[^a-zа-я0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return s;
}
function tokens(s) {
  return normalize(s).split(" ")
    .filter((t) => t && !/^\d+$/.test(t) && !["гр", "грамм", "г", "кг", "мл", "л", "шт", "штук", "вес", "целый", "цельный"].includes(t))
    .map((t) => (t.length > 5 ? t.slice(0, 5) : t));
}
function score(a, b) {
  const tA = tokens(a), tB = tokens(b);
  const A = new Set(tA), B = new Set(tB);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  const head = B.has(tA[0]) ? 0.3 : -0.3;
  return hit / Math.max(A.size, B.size) + (hit / Math.min(A.size, B.size)) * 0.5 + head;
}

const live = nomenclature.filter((x) => !x.deleted && ["DISH", "PREPARED", "GOODS"].includes(x.type));

// Ингредиенты ТТК с разворачиванием заготовок (глубина 2)
function collectIngredients(productId, depth = 0) {
  const chart = chartsByProduct.get(productId);
  if (!chart) return null;
  const names = [];
  for (const item of chart.items ?? []) {
    const ingredient = byId.get(item.productId);
    if (!ingredient) continue;
    if (ingredient.type === "MODIFIER" || ingredient.type === "SERVICE") continue;
    if (ingredient.type === "PREPARED" && depth < 2) {
      const nested = collectIngredients(ingredient.id, depth + 1);
      if (nested && nested.length > 0) {
        names.push(...nested);
        continue;
      }
    }
    names.push(ingredient.name.trim());
  }
  return names;
}

function findIngredientsForProduct(siteName) {
  const candidates = live
    .map((c) => ({ c, s: score(siteName, c.name) }))
    .filter((x) => x.s >= 1.15)
    .sort((a, b) => b.s - a.s)
    .slice(0, 12);

  for (const { c } of candidates) {
    const ingredients = collectIngredients(c.id);
    if (ingredients && ingredients.length >= 2) {
      return { source: c.name.trim(), ingredients: [...new Set(ingredients)] };
    }
  }
  return null;
}

// ── OpenAI ──
async function generateContent(product, ingredients) {
  const context = {
    название: product.name,
    категория: product.category,
    подкатегория: product.subcategory,
    фасовка: product.weightLabel,
    текущее_описание: product.description || null,
    текущий_состав: product.composition || null,
    ингредиенты_из_техкарты: ingredients?.ingredients ?? null,
  };

  const systemPrompt = `Ты — редактор карточек товаров B2B-пекарни DC Bakery (Алматы, Казахстан). Продукция халал.
По данным товара сгенерируй JSON строго такой структуры:
{
  "composition_ru": "состав по-русски: ингредиенты через запятую, по убыванию значимости, с маленькой буквы, точка в конце",
  "composition_kk": "тот же состав на казахском",
  "composition_en": "тот же состав на английском",
  "description_ru": "1–2 предложения о товаре: фактурно, аппетитно, без рекламных штампов и восклицаний, для оптовых покупателей (кофейни, рестораны, магазины)",
  "description_kk": "то же описание на казахском (естественный язык, не калька)",
  "description_en": "то же описание на английском",
  "name_kk": "название товара на казахском",
  "name_en": "название товара на английском"
}
Жёсткие правила:
- Состав собирай ТОЛЬКО из «ингредиенты_из_техкарты» и «текущий_состав»; ничего не выдумывай. Технические названия (например «*ПФ тесто 1», «инг», цифры партий) преврати в нормальные пищевые названия.
- Служебные слова (упаковка, лоток, вода для мытья) не включай.
- Если ингредиентов нет вовсе — составь состав из «текущий_состав» как есть (нормализовав), а при его отсутствии верни в полях состава пустую строку.
- Не упоминай цены, сертификаты, сроки годности.
- Названия «name_kk»/«name_en» — перевод названия, бренды и слова вроде «чизкейк», «дениш» транслитерируй естественно.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(context) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

// ── Существующие overrides (чтобы не затирать ручные правки) ──
async function fetchOverrides() {
  const response = await fetch(
    `${SB_URL}/rest/v1/catalog_product_overrides?select=product_id,description,composition,composition_kz,name_kk,name_en,description_kk,description_en,composition_en`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
  );
  if (!response.ok) throw new Error(`overrides fetch: ${response.status}`);
  const rows = await response.json();
  return new Map(rows.map((r) => [r.product_id, r]));
}

async function upsertOverride(productId, patch) {
  const response = await fetch(
    `${SB_URL}/rest/v1/catalog_product_overrides?on_conflict=product_id`,
    {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ product_id: productId, ...patch }),
    },
  );
  if (!response.ok) {
    throw new Error(`upsert ${productId}: ${response.status} ${await response.text()}`);
  }
}

// ── Основной цикл ──
const previous = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, "utf8")) : {};
const results = { ...previous };
const overrides = APPLY || SB_URL ? await fetchOverrides().catch(() => new Map()) : new Map();

let processed = 0;
let generated = 0;
let applied = 0;
let failed = 0;

for (const product of products) {
  if (ONLY && !ONLY.has(product.slug)) continue;
  if (processed >= LIMIT) break;
  processed++;

  try {
    let entry = results[product.slug];

    if (!entry || FORCE || ONLY) {
      const ingredients = findIngredientsForProduct(product.name);
      const content = await generateContent(product, ingredients);
      entry = {
        name: product.name,
        ttk_source: ingredients?.source ?? null,
        ttk_ingredients: ingredients?.ingredients ?? null,
        ...content,
        generated_at: new Date().toISOString(),
      };
      results[product.slug] = entry;
      generated++;
      writeFileSync(OUT_FILE, JSON.stringify(results, null, 1));
      console.log(`✓ ${product.slug}${ingredients ? ` (ТТК: ${ingredients.source})` : " (без ТТК)"}`);
      await new Promise((r) => setTimeout(r, 400));
    }

    if (APPLY) {
      const existing = overrides.get(product.id) ?? {};
      const patch = {};

      // Локализация: пишем, если пусто (или --force)
      for (const [col, key] of [
        ["name_kk", "name_kk"],
        ["name_en", "name_en"],
        ["description_kk", "description_kk"],
        ["description_en", "description_en"],
        ["composition_en", "composition_en"],
      ]) {
        if (entry[key] && (FORCE || !existing[col])) patch[col] = entry[key];
      }

      // Русские описание/состав и каз. состав: не затираем ручные правки менеджера
      if (entry.description_ru && (FORCE || !existing.description)) {
        patch.description = entry.description_ru;
      }
      if (entry.composition_ru && (FORCE || !existing.composition)) {
        patch.composition = entry.composition_ru;
      }
      if (entry.composition_kk && (FORCE || !existing.composition_kz)) {
        patch.composition_kz = entry.composition_kk;
      }

      if (Object.keys(patch).length > 0) {
        await upsertOverride(product.id, patch);
        applied++;
      }
    }
  } catch (error) {
    failed++;
    console.log(`✗ ${product.slug}: ${error.message}`);
  }
}

console.log("\n──────────");
console.log(`обработано: ${processed}, сгенерировано: ${generated}, записано в Supabase: ${applied}, ошибок: ${failed}`);
console.log(`результаты: ${OUT_FILE}`);
if (!APPLY) {
  console.log("Это был dry-run. Просмотрите файл и запустите с --apply для записи.");
}
