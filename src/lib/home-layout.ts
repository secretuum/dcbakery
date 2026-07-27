// Раскладка главной страницы для «конструктора сетки» суперадмина.
//
// Хранится ОТДЕЛЬНОЙ JSON-строкой в app_settings под ключом `home_layout`
// (таблица уже существует — миграций не требуется). Пока `enabled === false`
// или ключа нет — главная рендерится классическим кодом (полностью обратимо).
//
// Модель: страница = список СЕКЦИЙ сверху вниз. Секция бывает двух видов:
//   • grid   — свободная сетка с блоками (текст/заголовок/кнопка/картинка),
//              каждый блок имеет отдельные координаты для десктопа и телефона;
//   • band   — динамическая полоса во всю ширину (промо/каталог), рендерится
//              существующими компонентами, её нельзя разбирать на блоки.
//
// Этот модуль ЧИСТЫЙ (без server-only) — типы и утилиты нужны и на клиенте
// (редактор), и на сервере (loader в home-layout.server.ts).

export const HOME_LAYOUT_KEY = "home_layout";

export const DESKTOP_COLS = 12;
export const MOBILE_COLS = 4;
export const ROW_H_D = 48; // px, высота строки сетки на десктопе
export const ROW_H_M = 44; // px, высота строки сетки на телефоне
export const GRID_GAP = 12; // px, зазор между клетками

/** Ограничения (защита от раздувания JSON и мусора). */
export const MAX_SECTIONS = 20;
export const MAX_BLOCKS_PER_SECTION = 40;
export const MAX_TEXT_LEN = 2000;
export const MAX_URL_LEN = 600;

export type Device = "d" | "m";

/** Координаты блока в клетках сетки. */
export type GridPos = { x: number; y: number; w: number; h: number };

export type BlockType = "heading" | "text" | "button" | "image";

export type BlockAlign = "left" | "center" | "right";
export type BlockColor = "dark" | "muted" | "coral" | "white";
export type BlockSize = "sm" | "base" | "lg" | "xl";
export type ButtonStyle = "solid" | "outline";

export type Block = {
  id: string;
  type: BlockType;
  /** текст для heading/text и подпись для button */
  text?: string;
  /** ссылка для button */
  href?: string;
  /** URL картинки (из /api/admin/upload-image) для image */
  src?: string;
  /** alt для image */
  alt?: string;
  align?: BlockAlign;
  color?: BlockColor;
  size?: BlockSize;
  btnStyle?: ButtonStyle;
  /** позиция на десктопе (12 колонок) */
  d: GridPos;
  /** позиция на телефоне (4 колонки) */
  m: GridPos;
};

export type SectionType = "grid" | "promos" | "catalog";
export type SectionBg = "white" | "cream" | "dark";

export type Section = {
  id: string;
  type: SectionType;
  hidden?: boolean;
  bg?: SectionBg;
  /** только для type === "grid" */
  blocks?: Block[];
  /** высота grid-секции в строках (десктоп/телефон) */
  rowsD?: number;
  rowsM?: number;
};

export type HomeLayout = {
  enabled: boolean;
  sections: Section[];
};

// ─────────────────────────── id ───────────────────────────

let idCounter = 0;

/** Стабильный уникальный id блока/секции (клиентская сторона редактора). */
export function newId(prefix = "b"): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
    }
  } catch {
    // fallthrough
  }
  idCounter += 1;
  return `${prefix}_${idCounter}_${Date.now().toString(36)}`;
}

// ─────────────────────────── seed ───────────────────────────

// Стартовая раскладка = приближение текущей главной. Не пиксель-в-пиксель:
// это отправная точка, дальше суперадмин двигает под себя.

const HERO_TITLE = "Надёжные поставки\nдля вашего бизнеса";
const HERO_SUBTITLE =
  "Десерты, полуфабрикаты и мясо для кофеен, ресторанов, отелей и магазинов. " +
  "Оптовые цены, живые остатки, история заказов — всё в одном кабинете.";
const ABOUT_TITLE = "DC Bakery — B2B поставщик еды в Казахстане";
const ABOUT_TEXT =
  "Мы специализируемся на поставках продуктов питания для B2B-сегмента: " +
  "кофеен, ресторанов, гостиниц и магазинов. Работаем с 50+ партнёрами по всему Казахстану.";

export function seedSections(): Section[] {
  return [
    {
      id: newId("s"),
      type: "grid",
      bg: "white",
      rowsD: 6,
      rowsM: 9,
      blocks: [
        {
          id: newId(),
          type: "heading",
          text: HERO_TITLE,
          size: "xl",
          color: "dark",
          align: "left",
          d: { x: 0, y: 0, w: 7, h: 2 },
          m: { x: 0, y: 0, w: 4, h: 2 },
        },
        {
          id: newId(),
          type: "text",
          text: HERO_SUBTITLE,
          size: "base",
          color: "muted",
          align: "left",
          d: { x: 0, y: 2, w: 6, h: 2 },
          m: { x: 0, y: 2, w: 4, h: 3 },
        },
        {
          id: newId(),
          type: "button",
          text: "Открыть каталог",
          href: "/catalog",
          btnStyle: "solid",
          align: "left",
          d: { x: 0, y: 4, w: 3, h: 1 },
          m: { x: 0, y: 5, w: 4, h: 1 },
        },
        {
          id: newId(),
          type: "button",
          text: "Стать партнёром",
          href: "/profile",
          btnStyle: "outline",
          align: "left",
          d: { x: 3, y: 4, w: 3, h: 1 },
          m: { x: 0, y: 6, w: 4, h: 1 },
        },
      ],
    },
    { id: newId("s"), type: "promos", bg: "cream" },
    { id: newId("s"), type: "catalog", bg: "cream" },
    {
      id: newId("s"),
      type: "grid",
      bg: "white",
      rowsD: 5,
      rowsM: 7,
      blocks: [
        {
          id: newId(),
          type: "heading",
          text: ABOUT_TITLE,
          size: "lg",
          color: "dark",
          align: "left",
          d: { x: 0, y: 0, w: 8, h: 1 },
          m: { x: 0, y: 0, w: 4, h: 2 },
        },
        {
          id: newId(),
          type: "text",
          text: ABOUT_TEXT,
          size: "base",
          color: "muted",
          align: "left",
          d: { x: 0, y: 1, w: 7, h: 2 },
          m: { x: 0, y: 2, w: 4, h: 3 },
        },
        {
          id: newId(),
          type: "button",
          text: "Стать партнёром",
          href: "/profile",
          btnStyle: "solid",
          align: "left",
          d: { x: 0, y: 3, w: 3, h: 1 },
          m: { x: 0, y: 5, w: 4, h: 1 },
        },
      ],
    },
  ];
}

/** Полностью включённая стартовая раскладка (для кнопки «Включить конструктор»). */
export function seedLayout(): HomeLayout {
  return { enabled: true, sections: seedSections() };
}

// ─────────────────────────── sanitize ───────────────────────────

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampStr(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.slice(0, max);
  return s;
}

function clampPos(raw: unknown, cols: number): GridPos {
  const p = (raw ?? {}) as Record<string, unknown>;
  const x = clampInt(p.x, 0, cols - 1, 0);
  const w = clampInt(p.w, 1, cols - x, Math.min(cols, 4));
  const y = clampInt(p.y, 0, 500, 0);
  const h = clampInt(p.h, 1, 50, 1);
  return { x, y, w, h };
}

const BLOCK_TYPES: ReadonlySet<string> = new Set(["heading", "text", "button", "image"]);
const ALIGNS: ReadonlySet<string> = new Set(["left", "center", "right"]);
const COLORS: ReadonlySet<string> = new Set(["dark", "muted", "coral", "white"]);
const SIZES: ReadonlySet<string> = new Set(["sm", "base", "lg", "xl"]);
const BTN_STYLES: ReadonlySet<string> = new Set(["solid", "outline"]);
const SECTION_TYPES: ReadonlySet<string> = new Set(["grid", "promos", "catalog"]);
const BGS: ReadonlySet<string> = new Set(["white", "cream", "dark"]);

/** href разрешаем только относительный (/…) или http(s). */
function sanitizeHref(raw: unknown): string | undefined {
  const s = clampStr(raw, MAX_URL_LEN);
  if (!s) return undefined;
  const trimmed = s.trim();
  if (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

/** src картинки — только http(s) (URL из Supabase Storage). */
function sanitizeSrc(raw: unknown): string | undefined {
  const s = clampStr(raw, MAX_URL_LEN);
  if (!s) return undefined;
  const trimmed = s.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  return undefined;
}

function sanitizeBlock(raw: unknown): Block | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const type = typeof b.type === "string" && BLOCK_TYPES.has(b.type) ? (b.type as BlockType) : null;
  if (!type) return null;

  const block: Block = {
    id: (clampStr(b.id, 40) || newId()).replace(/[^a-zA-Z0-9_]/g, ""),
    type,
    d: clampPos(b.d, DESKTOP_COLS),
    m: clampPos(b.m, MOBILE_COLS),
  };
  if (!block.id) block.id = newId();

  const text = clampStr(b.text, MAX_TEXT_LEN);
  if (text !== undefined) block.text = text;
  const alt = clampStr(b.alt, 300);
  if (alt !== undefined) block.alt = alt;

  const href = sanitizeHref(b.href);
  if (href) block.href = href;
  const src = sanitizeSrc(b.src);
  if (src) block.src = src;

  if (typeof b.align === "string" && ALIGNS.has(b.align)) block.align = b.align as BlockAlign;
  if (typeof b.color === "string" && COLORS.has(b.color)) block.color = b.color as BlockColor;
  if (typeof b.size === "string" && SIZES.has(b.size)) block.size = b.size as BlockSize;
  if (typeof b.btnStyle === "string" && BTN_STYLES.has(b.btnStyle)) block.btnStyle = b.btnStyle as ButtonStyle;

  return block;
}

function sanitizeSection(raw: unknown): Section | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const type = typeof s.type === "string" && SECTION_TYPES.has(s.type) ? (s.type as SectionType) : null;
  if (!type) return null;

  const section: Section = {
    id: (clampStr(s.id, 40) || newId("s")).replace(/[^a-zA-Z0-9_]/g, ""),
    type,
  };
  if (!section.id) section.id = newId("s");

  if (s.hidden === true) section.hidden = true;
  if (typeof s.bg === "string" && BGS.has(s.bg)) section.bg = s.bg as SectionBg;

  if (type === "grid") {
    const rawBlocks = Array.isArray(s.blocks) ? s.blocks : [];
    section.blocks = rawBlocks
      .slice(0, MAX_BLOCKS_PER_SECTION)
      .map(sanitizeBlock)
      .filter((b): b is Block => b !== null);
    section.rowsD = clampInt(s.rowsD, 1, 60, 6);
    section.rowsM = clampInt(s.rowsM, 1, 80, 8);
  }

  return section;
}

export function sanitizeHomeLayout(raw: unknown): HomeLayout {
  if (typeof raw !== "object" || raw === null) return { enabled: false, sections: [] };
  const value = raw as Record<string, unknown>;
  const rawSections = Array.isArray(value.sections) ? value.sections : [];
  const sections = rawSections
    .slice(0, MAX_SECTIONS)
    .map(sanitizeSection)
    .filter((s): s is Section => s !== null);
  return { enabled: value.enabled === true, sections };
}

// ─────────────────────────── helpers для рендера ───────────────────────────

/** grid-column / grid-row строки для инлайн-стиля по устройству. */
export function gridArea(pos: GridPos): { gridColumn: string; gridRow: string } {
  return {
    gridColumn: `${pos.x + 1} / span ${pos.w}`,
    gridRow: `${pos.y + 1} / span ${pos.h}`,
  };
}

export function colsFor(device: Device): number {
  return device === "d" ? DESKTOP_COLS : MOBILE_COLS;
}

export function rowHeightFor(device: Device): number {
  return device === "d" ? ROW_H_D : ROW_H_M;
}
