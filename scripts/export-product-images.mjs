// Выгрузка ВСЕХ изображений товаров с сайта в одну папку, где имя файла = наименование
// товара. Нужно, чтобы пачкой улучшить качество фото и потом легко залить обратно через
// админку. Сливает два источника: статический каталог (src/data/products.ts, локальные
// файлы public/products/*) и переопределения из Supabase (admin-загруженные фото, обычно
// удалённые URL). Приоритет — как на сайте: override.image ?? базовое фото.
//
// Запуск из корня проекта (ключи берутся из .env.local, скрипт их не хранит):
//   node --env-file=.env.local scripts/export-product-images.mjs
//   node --env-file=.env.local scripts/export-product-images.mjs ./моя-папка
//
// Требует env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Итог: <папка>/<Наименование товара>.<ext> + <папка>/_manifest.csv (что откуда).

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.resolve(ROOT, process.argv[2] ?? "product-images-export");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "src", "data", "products.ts");

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ── 1) Статический каталог: вытащить массив products из TS-файла (объекты в JSON-стиле) ──
function extractProductsArray(tsSource) {
  const mi = tsSource.indexOf("export const products");
  if (mi < 0) throw new Error("В products.ts не найден `export const products`");
  const start = tsSource.indexOf("[", mi);
  if (start < 0) throw new Error("Не найдено начало массива products");
  let depth = 0;
  let inStr = false;
  let strCh = "";
  let esc = false;
  let end = -1;
  for (let i = start; i < tsSource.length; i++) {
    const c = tsSource[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = true;
      strCh = c;
    } else if (c === "[" || c === "{") {
      depth++;
    } else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("Не найден конец массива products");
  const arr = tsSource.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(arr);
}

// ── 2) Утилиты имени файла ──
function sanitizeName(name) {
  return (name || "без-названия")
    .replace(/[\\/:*?"<>|]+/g, " ") // запрещённые в Windows символы
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
function extOf(ref) {
  const clean = ref.split("?")[0].split("#")[0];
  const e = path.extname(clean).toLowerCase();
  return /^\.(webp|png|jpe?g|avif|gif|svg)$/.test(e) ? e : ".webp";
}
function isPlaceholder(image) {
  if (!image) return true;
  const l = image.toLowerCase();
  return l.includes("product-placeholder") || l.endsWith(".svg");
}

async function main() {
  if (!SUPABASE_URL || !KEY) {
    console.error(
      "Нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в env.\n" +
        "Запусти: node --env-file=.env.local scripts/export-product-images.mjs",
    );
    process.exit(1);
  }

  const base = extractProductsArray(fs.readFileSync(DATA_FILE, "utf8"));
  console.log(`Статический каталог: ${base.length} товаров`);

  // Переопределения из Supabase (admin-загруженные фото и правки имён/добавленные товары)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_product_overrides?select=product_id,name,slug,image,is_archived`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  if (!res.ok) throw new Error(`Supabase overrides: ${res.status} ${await res.text()}`);
  const overrides = await res.json();
  console.log(`Переопределений в Supabase: ${overrides.length}`);

  const ovByPid = new Map(overrides.map((o) => [o.product_id, o]));
  const baseIds = new Set(base.map((b) => b.id));

  // Эффективный список: как на сайте (override.image ?? базовое фото)
  const merged = [];
  for (const b of base) {
    const o = ovByPid.get(b.id);
    if (o?.is_archived) continue; // архивные на сайте не показываются
    merged.push({
      id: b.id,
      name: (o?.name && o.name.trim()) || b.name,
      slug: (o?.slug && o.slug.trim()) || b.slug,
      image: (o?.image && o.image.trim()) || b.image,
      category: b.category,
    });
  }
  for (const o of overrides) {
    if (baseIds.has(o.product_id) || o.is_archived) continue; // добавленные через админку товары
    if (!o.name || !o.slug) continue;
    merged.push({
      id: o.product_id,
      name: o.name.trim(),
      slug: o.slug.trim(),
      image: (o.image && o.image.trim()) || "",
      category: "(добавлен в админке)",
    });
  }
  console.log(`Итого к выгрузке: ${merged.length} товаров\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const usedNames = new Set();
  const rows = [["Наименование", "Категория", "slug", "id", "источник", "оригинал", "файл"]];
  let okCount = 0;
  let placeholderCount = 0;
  let errCount = 0;

  for (const p of merged) {
    if (isPlaceholder(p.image)) {
      placeholderCount++;
      rows.push([p.name, p.category, p.slug, p.id, "НЕТ ФОТО", p.image || "", ""]);
      console.log(`⚠ нет фото: ${p.name}`);
      continue;
    }

    const isRemote = /^https?:\/\//i.test(p.image);
    let file = `${sanitizeName(p.name)}${extOf(p.image)}`;
    // защита от коллизий имён
    let n = 2;
    while (usedNames.has(file.toLowerCase())) {
      file = `${sanitizeName(p.name)} (${n})${extOf(p.image)}`;
      n++;
    }
    usedNames.add(file.toLowerCase());
    const dest = path.join(OUT_DIR, file);

    try {
      if (isRemote) {
        const r = await fetch(p.image);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(dest, buf);
      } else {
        const localPath = path.join(PUBLIC_DIR, p.image.replace(/^\//, ""));
        if (!fs.existsSync(localPath)) throw new Error(`нет локального файла ${localPath}`);
        fs.copyFileSync(localPath, dest);
      }
      okCount++;
      rows.push([p.name, p.category, p.slug, p.id, isRemote ? "remote" : "local", p.image, file]);
      console.log(`✓ ${p.name}  →  ${file}`);
    } catch (e) {
      errCount++;
      rows.push([p.name, p.category, p.slug, p.id, "ОШИБКА", p.image, String(e.message ?? e)]);
      console.log(`✗ ${p.name}: ${e.message ?? e}`);
    }
  }

  // CSV (с BOM, чтобы Excel корректно открыл кириллицу)
  const csv =
    "﻿" +
    rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
  fs.writeFileSync(path.join(OUT_DIR, "_manifest.csv"), csv);

  console.log(
    `\nГотово. Папка: ${OUT_DIR}\n` +
      `  выгружено фото: ${okCount}\n` +
      `  без фото (заглушки, нужно снять): ${placeholderCount}\n` +
      `  ошибок: ${errCount}\n` +
      `  манифест: ${path.join(OUT_DIR, "_manifest.csv")}`,
  );
}

main().catch((e) => {
  console.error("Сбой экспорта:", e);
  process.exit(1);
});
