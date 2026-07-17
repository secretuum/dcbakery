// Зонд: проверяет доступность iiko API и вытаскивает каталог для сверки с сайтом.
// Секреты читаются из .env.local только внутри процесса и НЕ выводятся.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SITE = "C:/Users/delca/Desktop/yCdcPP/site";
const OUT = dirname(fileURLToPath(import.meta.url));

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

console.log("env check:", {
  IIKO_BASE_URL: base ? new URL(base).host : "(not set)",
  IIKO_API_LOGIN: env.IIKO_API_LOGIN ? "set" : "(not set)",
  IIKO_APP_ID: env.IIKO_APP_ID ? "set" : "(not set)",
  IIKO_CLIENT_SECRET: env.IIKO_CLIENT_SECRET ? "set" : "(not set)",
  IIKO_ORG_ID: env.IIKO_ORG_ID ? "set" : "(not set)",
  IIKO_RESTO_LOGIN: env.IIKO_RESTO_LOGIN ? "set" : "(not set)",
  IIKO_RESTO_PASS: env.IIKO_RESTO_PASS ? "set" : "(not set)",
  SUPABASE: env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "(not set)",
});

// ── Серверный API iikoOffice (resto) — номенклатура и ТТК ──
if (base && env.IIKO_RESTO_LOGIN && env.IIKO_RESTO_PASS) {
  const sha1 = createHash("sha1").update(env.IIKO_RESTO_PASS).digest("hex");
  let key = null;
  try {
    const res = await fetch(
      `${base}/resto/api/auth?login=${encodeURIComponent(env.IIKO_RESTO_LOGIN)}&pass=${sha1}`,
    );
    const text = (await res.text()).trim();
    if (res.ok && text && !text.includes("<")) key = text;
    console.log("resto auth ->", res.status, key ? "OK" : text.slice(0, 200));
  } catch (e) {
    console.log("resto auth -> FETCH ERROR:", e.message);
  }

  if (key) {
    try {
      const prodRes = await fetch(
        `${base}/resto/api/v2/entities/products/list?includeDeleted=false&key=${key}`,
      );
      const products = prodRes.ok ? await prodRes.json() : null;
      console.log("resto products ->", prodRes.status, Array.isArray(products) ? `count=${products.length}` : "");
      if (Array.isArray(products)) {
        writeFileSync(resolve(OUT, "iiko-resto-products.json"), JSON.stringify(products, null, 2));
        const types = {};
        for (const p of products) types[p.type] = (types[p.type] ?? 0) + 1;
        console.log("product types:", types);
        console.log(
          "sample:",
          products.slice(0, 5).map((p) => `${p.name} [type=${p.type}, price=${p.defaultSalePrice ?? "-"}]`),
        );
      }

      const chartRes = await fetch(
        `${base}/resto/api/v2/assemblyCharts/getAll?dateFrom=2020-01-01&includeDeletedProducts=false&includePreparedCharts=false&key=${key}`,
      );
      const charts = chartRes.ok ? await chartRes.json() : null;
      console.log(
        "resto assemblyCharts (ТТК) ->", chartRes.status,
        charts?.assemblyCharts ? `count=${charts.assemblyCharts.length}` : "",
      );
      if (charts) writeFileSync(resolve(OUT, "iiko-resto-ttk.json"), JSON.stringify(charts, null, 2));
    } finally {
      // Лицензии API ограничены — обязательно выходим
      await fetch(`${base}/resto/api/logout?key=${key}`).catch(() => {});
      console.log("resto logout: done");
    }
  }
}

async function tryJson(label, url, init) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(label, "->", res.status, json ? "(json)" : text.slice(0, 200));
    return { status: res.status, json };
  } catch (e) {
    console.log(label, "-> FETCH ERROR:", e.message);
    return { status: 0, json: null };
  }
}

let token = null;
let apiFlavor = null;

if (base) {
  // Вариант 1: как написано в src/lib/iiko.ts (/api/v2)
  const v2 = await tryJson("token v2", `${base}/api/v2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiLogin: env.IIKO_API_LOGIN,
      appId: env.IIKO_APP_ID,
      clientSecret: env.IIKO_CLIENT_SECRET,
    }),
  });
  if (v2.json?.token) { token = v2.json.token; apiFlavor = "v2"; }

  // Вариант 2: стандартный iikoCloud (/api/1)
  if (!token) {
    const v1 = await tryJson("token v1 (iikoCloud)", `${base}/api/1/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiLogin: env.IIKO_API_LOGIN }),
    });
    if (v1.json?.token) { token = v1.json.token; apiFlavor = "cloud1"; }
  }
}

console.log("auth result:", token ? `OK (${apiFlavor})` : "FAILED");

if (token) {
  const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const orgUrl = apiFlavor === "v2" ? `${base}/api/v2/organizations` : `${base}/api/1/organizations`;
  const orgs = await tryJson("organizations", orgUrl, {
    method: "POST", headers: auth,
    body: JSON.stringify({ organizationIds: [], returnAdditionalInfo: false, includeDisabled: false }),
  });

  const orgList = orgs.json?.organizations ?? [];
  console.log("orgs:", orgList.map((o) => `${o.name} [${o.id}]`));

  const target =
    orgList.find((o) => /b2b/i.test(o.name) && /пекарн|bakery/i.test(o.name)) ??
    orgList.find((o) => /b2b/i.test(o.name)) ??
    orgList[0];

  if (target) {
    console.log("target org:", target.name, target.id);
    const nomUrl =
      apiFlavor === "v2"
        ? `${base}/api/v2/nomenclature/${target.id}`
        : `${base}/api/1/nomenclature`;
    const nomInit =
      apiFlavor === "v2"
        ? { headers: { Authorization: `Bearer ${token}` } }
        : { method: "POST", headers: auth, body: JSON.stringify({ organizationId: target.id }) };
    const nom = await tryJson("nomenclature", nomUrl, nomInit);

    if (nom.json) {
      writeFileSync(resolve(OUT, "iiko-nomenclature.json"), JSON.stringify(nom.json, null, 2));
      const products = nom.json.products ?? [];
      console.log("nomenclature: products =", products.length,
        "| categories =", (nom.json.productCategories ?? []).length,
        "| sizes =", (nom.json.sizes ?? []).length);
      console.log("sample:", JSON.stringify(products.slice(0, 3), null, 2).slice(0, 1500));
    }

    // Стоп-лист (наличие) — только в iikoCloud
    if (apiFlavor === "cloud1") {
      const stop = await tryJson("stop_lists", `${base}/api/1/stop_lists`, {
        method: "POST", headers: auth, body: JSON.stringify({ organizationIds: [target.id] }),
      });
      if (stop.json) writeFileSync(resolve(OUT, "iiko-stoplist.json"), JSON.stringify(stop.json, null, 2));
    }
  }
}

// ── Supabase: переопределения цен на сайте ──
if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const sb = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(
    `${sb}/rest/v1/catalog_product_overrides?select=product_id,name,price,stock_qty,is_active,is_archived,unit,min_qty,step_qty`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const rows = res.ok ? await res.json() : [];
  console.log("supabase overrides:", res.status, "rows =", rows.length);
  writeFileSync(resolve(OUT, "site-overrides.json"), JSON.stringify(rows, null, 2));
}
