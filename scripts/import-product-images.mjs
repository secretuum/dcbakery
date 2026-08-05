// Массовая ЗАГРУЗКА улучшенных фото товаров обратно на сайт. Зеркало export-product-images:
// берёт папку с файлами, имя которых = наименование товара, сопоставляет с каталогом,
// заливает КАК ЕСТЬ в Supabase Storage (bucket product-images/products/<slug>.<ext>) и
// прописывает URL в catalog_product_overrides.image. Пережатия НЕТ — предполагается, что
// изображения уже адаптированы (оптимизированы/сжаты) на стороне подготовки.
// По умолчанию — DRY-RUN (только план, без записи).
//
// Запуск из корня проекта (ключи из .env.local, скрипт их не хранит):
//   node --env-file=.env.local scripts/import-product-images.mjs [папка]           # DRY-RUN
//   node --env-file=.env.local scripts/import-product-images.mjs [папка] --apply    # реально залить
// По умолчанию папка = ./product-images-improved
//
// Требует env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ВАЖНО: файлы НЕ переименовывать — имя файла (без расширения) = наименование товара из выгрузки.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IN_DIR = path.resolve(ROOT, process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) ?? "product-images-improved");
const APPLY = process.argv.includes("--apply");
const DATA_FILE = path.join(ROOT, "src", "data", "products.ts");
const BUCKET = "product-images";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// ── те же примитивы, что в export-product-images.mjs (сопоставление обязано совпадать) ──
function extractProductsArray(tsSource) {
  const mi = tsSource.indexOf("export const products");
  if (mi < 0) throw new Error("В products.ts не найден `export const products`");
  const start = tsSource.indexOf("[", mi);
  let depth = 0, inStr = false, strCh = "", esc = false, end = -1;
  for (let i = start; i < tsSource.length; i++) {
    const c = tsSource[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; }
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error("Не найден конец массива products");
  return JSON.parse(tsSource.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1"));
}
function sanitizeName(name) {
  return (name || "без-названия").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}
function matchKey(name) {
  return sanitizeName(name).toLowerCase();
}
function fileExt(f) {
  const e = path.extname(f).toLowerCase();
  return /^\.(webp|png|jpe?g|avif)$/.test(e) ? e : ".webp";
}
function contentType(ext) {
  return { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".avif": "image/avif" }[ext] ?? "application/octet-stream";
}
function slugPath(slug, ext) {
  const s = String(slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `products/${s}${ext}`;
}

async function loadMergedCatalog() {
  const base = extractProductsArray(fs.readFileSync(DATA_FILE, "utf8"));
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_product_overrides?select=product_id,name,slug,image,is_archived`,
    { headers: H },
  );
  if (!res.ok) throw new Error(`Supabase overrides: ${res.status} ${await res.text()}`);
  const overrides = await res.json();
  const ovByPid = new Map(overrides.map((o) => [o.product_id, o]));
  const withRow = new Set(overrides.map((o) => o.product_id));
  const baseIds = new Set(base.map((b) => b.id));

  const merged = [];
  for (const b of base) {
    const o = ovByPid.get(b.id);
    if (o?.is_archived) continue;
    merged.push({
      id: b.id,
      name: (o?.name && o.name.trim()) || b.name,
      slug: (o?.slug && o.slug.trim()) || b.slug,
      image: (o?.image && o.image.trim()) || b.image,
      hasRow: withRow.has(b.id),
    });
  }
  for (const o of overrides) {
    if (baseIds.has(o.product_id) || o.is_archived || !o.name || !o.slug) continue;
    merged.push({ id: o.product_id, name: o.name.trim(), slug: o.slug.trim(), image: (o.image && o.image.trim()) || "", hasRow: true });
  }
  return merged;
}

async function uploadImage(buf, storagePath, ctype) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: "POST",
    headers: { ...H, "Content-Type": ctype, "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload ${storagePath}: ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function setOverrideImage(product, url) {
  const nowIso = new Date().toISOString();
  if (product.hasRow) {
    // точечный PATCH — не трогаем is_archived и прочие поля
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/catalog_product_overrides?product_id=eq.${encodeURIComponent(product.id)}`,
      { method: "PATCH", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ image: url, updated_at: nowIso }) },
    );
    if (!res.ok) throw new Error(`patch ${product.id}: ${res.status} ${await res.text()}`);
  } else {
    // строки нет (товар только из статического каталога) — создаём разреженную запись
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_product_overrides`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, image: url, is_archived: false, updated_at: nowIso }),
    });
    if (!res.ok) throw new Error(`insert ${product.id}: ${res.status} ${await res.text()}`);
    product.hasRow = true;
  }
}

async function main() {
  if (!SUPABASE_URL || !KEY) {
    console.error("Нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в env.\nЗапусти: node --env-file=.env.local scripts/import-product-images.mjs");
    process.exit(1);
  }
  if (!fs.existsSync(IN_DIR)) {
    console.error(`Папка не найдена: ${IN_DIR}\nПоложи улучшенные фото туда (имена файлов не менять) или укажи путь аргументом.`);
    process.exit(1);
  }

  const merged = await loadMergedCatalog();
  const byName = new Map();
  const collisions = [];
  for (const p of merged) {
    const k = matchKey(p.name);
    if (byName.has(k)) collisions.push(p.name);
    else byName.set(k, p);
  }
  if (collisions.length) console.log(`⚠ одинаковые имена (сопоставление может быть неоднозначным): ${collisions.join(", ")}\n`);

  // Рекурсивно: файлы могут лежать в подпапках (напр. manual-review/…). Исключаем
  // contact-sheets (before/after QA-листы — это НЕ фото товаров) и служебные `_*`.
  const files = fs
    .readdirSync(IN_DIR, { recursive: true })
    .map(String)
    .filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f))
    .filter((f) => !path.basename(f).startsWith("_"))
    .filter((f) => !f.replace(/\\/g, "/").toLowerCase().includes("contact-sheet"));
  console.log(`${APPLY ? "ЗАЛИВКА" : "DRY-RUN (без записи)"} — папка: ${IN_DIR}\nфайлов: ${files.length}, товаров в каталоге: ${merged.length}\n`);

  const matched = [];
  const unmatchedFiles = [];
  for (const f of files) {
    const key = matchKey(path.basename(f, path.extname(f)));
    const product = byName.get(key);
    if (product) matched.push({ f, product });
    else unmatchedFiles.push(f);
  }
  const matchedIds = new Set(matched.map((m) => m.product.id));
  const productsWithoutFile = merged.filter((p) => !matchedIds.has(p.id));

  let ok = 0, err = 0;
  for (const { f, product } of matched) {
    const ext = fileExt(f);
    const storagePath = slugPath(product.slug, ext);
    if (!APPLY) {
      console.log(`✓ ${f}  →  ${product.name} [${product.slug}]  →  ${storagePath}`);
      continue;
    }
    try {
      const buf = fs.readFileSync(path.join(IN_DIR, f));
      const url = await uploadImage(buf, storagePath, contentType(ext));
      await setOverrideImage(product, url);
      ok++;
      console.log(`✓ ${f}  →  ${product.name}  (${Math.round(buf.length / 1024)}КБ)`);
    } catch (e) {
      err++;
      console.log(`✗ ${f} (${product.name}): ${e.message ?? e}`);
    }
  }

  console.log(`\n── ИТОГ ──`);
  console.log(`сопоставлено файлов: ${matched.length}`);
  if (unmatchedFiles.length) console.log(`НЕ сопоставлено (имя не совпало с товаром): ${unmatchedFiles.length}\n  ${unmatchedFiles.join("\n  ")}`);
  if (productsWithoutFile.length) console.log(`товары без присланного фото: ${productsWithoutFile.length}\n  ${productsWithoutFile.map((p) => p.name).join(", ")}`);
  if (APPLY) {
    console.log(`\nзалито: ${ok}, ошибок: ${err}`);
    console.log(`Кэш каталога обновится в течение ~10 мин (окно revalidate) или сразу при любой правке товара в админке.`);
  } else {
    console.log(`\nЭто был DRY-RUN. Проверь список выше. Для реальной заливки добавь --apply.`);
  }
}

main().catch((e) => { console.error("Сбой импорта:", e); process.exit(1); });
