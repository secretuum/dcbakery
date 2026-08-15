import "server-only";
import { readOoxmlCells } from "@/src/lib/catalog-import";
import { openaiChatJson, isOpenAiConfigured } from "@/src/lib/whatsapp/orders/ai/openai";

// «Умная загрузка» промо-цен: принимает ЛЮБОЙ прайс (xlsx/csv/текст, произвольные
// колонки — хоть «название + цена»), извлекает текст и через ИИ строго сопоставляет
// позиции с нашим каталогом по названию. Ничего не выдумывает: чего не узнал — в unmatched.

export { isOpenAiConfigured };

const MAX_TEXT = 24000; // защита от гигантских файлов в промпте

/** Порядок колонок: сначала по длине буквы (A..Z, потом AA..), затем лексикографически. */
function colSort(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

// Управляющие байты (кроме \t \n \r) — признак бинарного файла, а не текстового прайса.
const CONTROL_CHARS = /[\x00-\x08\x0e-\x1f]/;

/**
 * Достать из файла плоский текст-таблицу для ИИ. xlsx (в т.ч. «кривой», который не
 * читает ExcelJS) — через readOoxmlCells; csv/txt/иное — как UTF-8 текст.
 */
export async function extractFileTable(
  buffer: ArrayBuffer,
  filename: string,
): Promise<{ text: string; warning?: string }> {
  const bytes = new Uint8Array(buffer);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK" → xlsx/zip
  const lower = filename.toLowerCase();

  if (isZip || lower.endsWith(".xlsx")) {
    try {
      const cells = await readOoxmlCells(buffer);
      if (cells.length) {
        const text = cells
          .slice()
          .sort((a, b) => a.n - b.n)
          .map((r) => Object.keys(r.cells).sort(colSort).map((c) => r.cells[c]).join("\t"))
          .join("\n")
          .slice(0, MAX_TEXT);
        if (text.trim()) return { text };
      }
    } catch {
      // упадём в общий возврат ниже
    }
    return { text: "", warning: "Не смог прочитать таблицу из xlsx. Пришлите .csv или текст (название и цена)." };
  }

  // csv / txt / произвольный текст
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  if (!decoded || CONTROL_CHARS.test(decoded.slice(0, 200))) {
    return { text: "", warning: "Формат не распознан. Пришлите .xlsx, .csv или текст: название и цена." };
  }
  return { text: decoded.slice(0, MAX_TEXT) };
}

export type PriceMatch = { id: string; price: number; matchedName: string };

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          price: { type: "number" },
          matchedName: { type: "string" },
        },
        required: ["id", "price", "matchedName"],
        additionalProperties: false,
      },
    },
    unmatched: { type: "array", items: { type: "string" } },
  },
  required: ["matches", "unmatched"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  "Ты сопоставляешь загруженный прайс-лист с нашим каталогом. Тебе дан КАТАЛОГ (строки " +
  "«id<TAB>название») и СЫРОЙ ТЕКСТ файла клиента (названия и цены в произвольном виде). " +
  "Для каждой позиции из файла, которую ты УВЕРЕННО узнаёшь в каталоге, верни id каталога и " +
  "новую цену — число в тенге, без пробелов и валюты. Сопоставляй по смыслу русского названия " +
  "(возможны сокращения, опечатки, другой порядок слов, разный регистр). СТРОГО: не выдумывай " +
  "товары и цены. Если позиции нет в каталоге, или не уверен, или цена не число — клади исходную " +
  "строку файла в unmatched. Одну позицию каталога возвращай не более одного раза.";

/**
 * ИИ-сопоставление сырого текста прайса с каталогом. Возвращает валидированные пары
 * {id, price} и список нераспознанных строк. Чистит выдумки: id только из каталога,
 * цена > 0, без дублей id.
 */
export async function smartMatchPrices(params: {
  fileText: string;
  catalog: { id: string; name: string }[];
  model?: string;
}): Promise<{ matches: PriceMatch[]; unmatched: string[] }> {
  const model = params.model ?? process.env.WHATSAPP_AGENT_MODEL ?? "gpt-4o-mini";
  const catalogText = params.catalog.map((p) => `${p.id}\t${p.name}`).join("\n");
  const user = `КАТАЛОГ:\n${catalogText}\n\nФАЙЛ КЛИЕНТА:\n${params.fileText}`;

  const raw = (await openaiChatJson({
    model,
    system: SYSTEM_PROMPT,
    user,
    schema: MATCH_SCHEMA,
    schemaName: "promo_price_match",
    timeoutMs: 60000,
  })) as { matches?: unknown[]; unmatched?: unknown[] };

  const catalogIds = new Set(params.catalog.map((p) => p.id));
  const seen = new Set<string>();
  const matches: PriceMatch[] = [];
  for (const m of raw.matches ?? []) {
    if (!m || typeof m !== "object") continue;
    const { id, price, matchedName } = m as Record<string, unknown>;
    if (typeof id !== "string" || !catalogIds.has(id) || seen.has(id)) continue;
    const num = Number(price);
    if (!Number.isFinite(num) || num <= 0) continue;
    seen.add(id);
    matches.push({ id, price: Math.round(num), matchedName: String(matchedName ?? "") });
  }
  const unmatched = (raw.unmatched ?? []).filter((x): x is string => typeof x === "string").slice(0, 300);
  return { matches, unmatched };
}
