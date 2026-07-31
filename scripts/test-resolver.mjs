// Резолвер модулей для встроенного node:test.
// Node не знает про tsconfig-алиас "@/*" и требует расширения в ESM-импортах, а
// кодовая база пишет "@/..." и без расширений. Этот hook закрывает оба случая:
//  - "@/x"        -> <repoRoot>/x(.ts|.tsx|/index.ts)
//  - "./x"/"../x" -> добавляем .ts/.tsx/index при отсутствии расширения
// Тесты гоняются нативным TS-стриппингом Node 24 (никаких новых зависимостей).

import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();
const EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"];

function isFile(p) {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function resolveWithExt(absNoExt) {
  if (isFile(absNoExt)) return absNoExt;
  for (const e of EXTS) if (isFile(absNoExt + e)) return absNoExt + e;
  if (isDir(absNoExt)) {
    for (const e of EXTS) {
      const idx = path.join(absNoExt, "index" + e);
      if (isFile(idx)) return idx;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = resolveWithExt(path.join(root, specifier.slice(2)));
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    if (context.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const found = resolveWithExt(path.resolve(parentDir, specifier));
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
