// Записывает казахские переводы товаров (name_kk/description_kk) в
// catalog_product_overrides. Источник — JSON воркфлоу (result.products[]).
// PATCH если строка есть, INSERT если нет (is_archived не трогаем/ставим false на новых).
// Запуск: node --env-file=.env.local scripts/apply-kk-translations.mjs <path-to-workflow-output.json>

import fs from "node:fs";

const OUTPUT = process.argv[2];
if (!OUTPUT) {
  console.error("Укажи путь к JSON воркфлоу аргументом.");
  process.exit(1);
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_URL || !KEY) {
  console.error("Нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (--env-file=.env.local).");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const parsed = JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
const products = parsed.result?.products ?? parsed.products ?? [];
if (!products.length) {
  console.error("В файле нет result.products[].");
  process.exit(1);
}

const existRes = await fetch(`${SUPABASE_URL}/rest/v1/catalog_product_overrides?select=product_id`, { headers: H });
const existing = new Set((await existRes.json()).map((r) => r.product_id));

let ok = 0;
let err = 0;
for (const p of products) {
  if (!p.id || !p.name_kk) continue;
  const nowIso = new Date().toISOString();
  const patch = { name_kk: p.name_kk, description_kk: p.description_kk ?? null, updated_at: nowIso };
  let res;
  if (existing.has(p.id)) {
    res = await fetch(
      `${SUPABASE_URL}/rest/v1/catalog_product_overrides?product_id=eq.${encodeURIComponent(p.id)}`,
      { method: "PATCH", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(patch) },
    );
  } else {
    res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_product_overrides`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: p.id, is_archived: false, ...patch }),
    });
  }
  if (res.ok) {
    ok++;
  } else {
    err++;
    console.error(`✗ ${p.id}: ${res.status} ${await res.text()}`);
  }
}
console.log(`Казахские переводы товаров: обновлено ${ok}, ошибок ${err} (всего ${products.length}).`);
