// Извлекает все строки-литералы из вызовов t("...") / t('...') по коду и находит,
// каких нет в словарях kk.json/en.json. Пишет scripts/missing-kk.json.
// Запуск: node scripts/i18n-missing.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const kk = JSON.parse(fs.readFileSync("src/i18n/kk.json", "utf8"));
const en = JSON.parse(fs.readFileSync("src/i18n/en.json", "utf8"));

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "app"))].filter(
  (f) => !f.includes(`${path.sep}i18n${path.sep}`),
);

const re = /\bt\(\s*(["'])((?:\\.|(?!\1).)*)\1/g;
const strings = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const raw = m[2].replace(/\\(["'\\])/g, "$1");
    if (raw.trim()) strings.add(raw);
  }
}

const missingKk = [...strings].filter((s) => !(s in kk)).sort();
const missingEn = [...strings].filter((s) => !(s in en)).sort();
console.log(
  `t()-строк всего: ${strings.size} | нет в kk: ${missingKk.length} | нет в en: ${missingEn.length}`,
);
fs.writeFileSync("scripts/missing-kk.json", JSON.stringify(missingKk, null, 2));
fs.writeFileSync("scripts/missing-en.json", JSON.stringify(missingEn, null, 2));
console.log("— примеры отсутствующих в kk —");
console.log(missingKk.slice(0, 15).join("\n"));
