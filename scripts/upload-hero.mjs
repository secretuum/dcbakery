// Разовая загрузка cutout-фото героя (прозрачный фон) в Supabase Storage.
// Пережимает в WebP с альфа-каналом (≤1000px, лёгкие) и кладёт в bucket
// product-images/site/. Печатает публичные URL — их проставляем в site_content
// (home.hero.imgMain/imgA/imgB). Запуск: node --env-file=.env.local scripts/upload-hero.mjs

import fs from "node:fs";
import sharp from "sharp";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET = "product-images";

if (!SUPABASE_URL || !KEY) {
  console.error("Нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Запусти с --env-file=.env.local");
  process.exit(1);
}

const files = [
  { src: "C:/Users/delca/Downloads/DSC03710-fotor-bg-remover-20260805145522.png", path: "site/hero-medovik.webp" },
  { src: "C:/Users/delca/Downloads/DSC03509-fotor-bg-remover-20260805145458.png", path: "site/hero-cheesecake.webp" },
  { src: "C:/Users/delca/Downloads/DSC04109-fotor-bg-remover-20260805145517.png", path: "site/hero-roll.webp" },
];

for (const f of files) {
  const webp = await sharp(fs.readFileSync(f.src))
    .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 90 }) // сохраняем прозрачность
    .toBuffer();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${f.path}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "image/webp", "x-upsert": "true" },
    body: webp,
  });
  if (!res.ok) {
    console.error(f.path, res.status, await res.text());
    process.exit(1);
  }
  console.log(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${f.path}  (${Math.round(webp.length / 1024)}КБ)`);
}
