// Сверка цен сайт ↔ iiko по кэшу .iiko-cache/ (офлайн, без API и без .env.local).
// Матчит позиции сайта с номенклатурой iiko по нормализованным названиям,
// группирует кандидатов по прайс-префиксам (ОПТ / В2В / Каспи / К / без префикса).
// Выход: консольная таблица + .iiko-cache/price-match-report.json
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CACHE = resolve(dirname(fileURLToPath(import.meta.url)), "../.iiko-cache");
const site = JSON.parse(readFileSync(resolve(CACHE, "site-static-catalog.json"), "utf8"));
const overrides = JSON.parse(readFileSync(resolve(CACHE, "site-overrides.json"), "utf8"));
const iiko = JSON.parse(readFileSync(resolve(CACHE, "iiko-resto-products.json"), "utf8"));

const PREFIXES = [
  { key: "ОПТ", re: /^\s*опт\s+/i },
  { key: "В2В", re: /^\s*(в2в|b2b)\s+/i },
  { key: "Каспи", re: /^\s*каспи\s+/i },
  { key: "К", re: /^\s*к\s+/i },
];

function priceGroup(name) {
  for (const p of PREFIXES) if (p.re.test(name)) return p.key;
  return "проч";
}

// Нормализация: убрать префиксы каналов и техпометки, ё→е, только буквы/цифры
function normalize(raw) {
  let s = raw.toLowerCase().replace(/ё/g, "е");
  s = s.replace(/\|-+>?\s*вынос/g, " ");
  s = s.replace(/^\s*(опт|в2в|b2b|каспи|чоко|тв|г\/п|п\/ф|пф|п\\ф|к)\s+/i, "");
  s = s.replace(/^\s*[-*]+\s*/, "");
  s = s.replace(/\*+/g, " ");
  s = s.replace(/[^a-zа-я0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return s;
}

// Токены со срезанными окончаниями — «говяжьи»/«говядиной» → «говя»/«говяди»
function tokens(s) {
  return normalize(s)
    .split(" ")
    .filter((t) => t && !/^\d+$/.test(t) && !["гр", "грамм", "г", "кг", "мл", "л", "шт", "штук", "вес"].includes(t))
    .map((t) => (t.length > 5 ? t.slice(0, 5) : t));
}

function score(a, b) {
  const tA = tokens(a);
  const tB = tokens(b);
  const A = new Set(tA);
  const B = new Set(tB);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  // главное слово («Пельмени», «Самса», «Фарш») обязано совпасть — иначе штраф,
  // при совпадении бонус: тай-брейк против «Самса»↔«Манты», «Фарш»↔«Котлеты»
  const head = B.has(tA[0]) ? 0.3 : -0.3;
  return hit / Math.max(A.size, B.size) + (hit / Math.min(A.size, B.size)) * 0.5 + head;
}

const candidates = iiko.filter(
  (x) => !x.deleted && ["DISH", "GOODS", "PREPARED"].includes(x.type),
);

const ovByName = new Map(overrides.map((o) => [o.product_id, o]));
const report = [];

for (const item of site) {
  const ov = ovByName.get(item.id);
  const sitePrice = ov?.price ?? item.price;
  const scored = candidates
    .map((c) => ({ c, s: score(item.name, c.name) }))
    .filter((x) => x.s >= 0.75)
    .sort((a, b) => b.s - a.s);

  // лучший кандидат в каждой прайс-группе
  const byGroup = {};
  for (const { c, s } of scored) {
    const g = priceGroup(c.name);
    if (!byGroup[g]) byGroup[g] = { name: c.name.trim(), price: c.defaultSalePrice, type: c.type, score: +s.toFixed(2), id: c.id };
  }

  const opt = byGroup["ОПТ"]?.price;
  const status = opt == null
    ? (Object.keys(byGroup).length ? "нет ОПТ-цены" : "НЕ НАЙДЕНО")
    : opt === sitePrice ? "ok" : `РАСХОЖДЕНИЕ: сайт ${sitePrice} ≠ ОПТ ${opt}`;

  report.push({
    site: { id: item.id, name: item.name, category: item.category, price: sitePrice, fromOverride: ov ? true : false, archived: ov?.is_archived ?? false },
    status,
    matches: byGroup,
  });
}

writeFileSync(resolve(CACHE, "price-match-report.json"), JSON.stringify(report, null, 2));

const pad = (s, n) => String(s).padEnd(n);
for (const r of report) {
  console.log(`\n${pad(r.site.name, 38)} сайт=${r.site.price}${r.site.archived ? " (архив)" : ""}  →  ${r.status}`);
  for (const [g, m] of Object.entries(r.matches)) {
    console.log(`   ${pad(g, 6)} ${m.price}\t${m.name}  (score ${m.score})`);
  }
}
const bad = report.filter((r) => r.status !== "ok");
console.log(`\nИтого: ${report.length} позиций, ok: ${report.length - bad.length}, проблемных: ${bad.length}`);
