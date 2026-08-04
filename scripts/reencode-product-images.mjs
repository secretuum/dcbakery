// Ре-энкод уже загруженных фото товаров в Supabase Storage: даунскейл до 1280px и
// пережатие. Раньше кадратор отдавал lossless PNG до 4096px (десятки МБ) — сайт стал
// тяжёлым и лагал (сервер пережимал гигантские исходники + egress Supabase). Скрипт
// ужимает существующие объекты, СОХРАНЯЯ путь и расширение — публичные URL товаров
// остаются валидными, ничего в БД править не нужно.
//
// Запуск из корня проекта (ключи берутся из .env.local, скрипт их не хранит):
//   node --env-file=.env.local scripts/reencode-product-images.mjs           # DRY-RUN (только отчёт)
//   node --env-file=.env.local scripts/reencode-product-images.mjs --apply   # реально перезаписать
//
// Требует env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. sharp уже в проекте.

import sharp from "sharp";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET = "product-images";
const PREFIXES = ["products/", "site/"];
const MAX_DIM = 1280;
const SIZE_SKIP = 800 * 1024; // уже лёгкие (≤1280px и ≤800КБ) не трогаем
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !KEY) {
  console.error(
    "Нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в env.\n" +
      "Запусти: node --env-file=.env.local scripts/reencode-product-images.mjs",
  );
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function listAll(prefix) {
  const out = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${prefix}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    // Записи без id — это подпапки; их пропускаем (один уровень).
    out.push(...page.filter((o) => o.id && o.name).map((o) => o.name));
    if (page.length < 100) break;
    offset += 100;
  }
  return out;
}

function encode(path, pipeline) {
  const ext = path.toLowerCase().split(".").pop();
  if (ext === "png") return { pipeline: pipeline.png({ compressionLevel: 9 }), mime: "image/png" };
  if (ext === "webp") return { pipeline: pipeline.webp({ quality: 90 }), mime: "image/webp" };
  return { pipeline: pipeline.jpeg({ quality: 85, mozjpeg: true }), mime: "image/jpeg" };
}

const kb = (n) => (n / 1024).toFixed(0);
const mb = (n) => (n / 1048576).toFixed(1);
let before = 0;
let after = 0;
let changed = 0;
let skipped = 0;

for (const prefix of PREFIXES) {
  let names = [];
  try {
    names = await listAll(prefix);
  } catch (e) {
    console.error(e.message);
    continue;
  }

  for (const name of names) {
    const path = `${prefix}${name}`;
    const dl = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { headers: H });
    if (!dl.ok) {
      console.warn(`skip ${path}: download ${dl.status}`);
      continue;
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    const meta = await sharp(buf).metadata().catch(() => null);
    if (!meta?.width) {
      console.warn(`skip ${path}: не изображение`);
      continue;
    }

    const maxDim = Math.max(meta.width, meta.height ?? 0);
    if (maxDim <= MAX_DIM && buf.length <= SIZE_SKIP) {
      skipped += 1;
      continue;
    }

    const { pipeline, mime } = encode(
      path,
      sharp(buf).rotate().resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true }),
    );
    const outBuf = await pipeline.toBuffer();

    // Не раздуваем: если после пережатия не легче — оставляем как есть.
    if (outBuf.length >= buf.length) {
      skipped += 1;
      continue;
    }

    before += buf.length;
    after += outBuf.length;
    changed += 1;
    console.log(`${APPLY ? "RE-ENCODE" : "would"} ${path}: ${kb(buf.length)}KB → ${kb(outBuf.length)}KB (${maxDim}px→≤${MAX_DIM})`);

    if (APPLY) {
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: { ...H, "Content-Type": mime, "x-upsert": "true" },
        body: outBuf,
      });
      if (!up.ok) console.error(`  upload failed ${path}: ${up.status} ${await up.text()}`);
    }
  }
}

console.log(
  `\n${APPLY ? "Готово" : "DRY-RUN"}: ужать ${changed} файлов, ${skipped} уже лёгкие. ` +
    `Вес ${mb(before)}MB → ${mb(after)}MB.`,
);
if (!APPLY && changed > 0) console.log("Перезаписать по-настоящему: добавь флаг --apply");
