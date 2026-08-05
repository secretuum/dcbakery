"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { LocaleLink as Link } from "@/src/i18n/LocaleLink";
import { useRouter } from "next/navigation";
import { useSiteEditFlag } from "./SiteEditMode";
import {
  colsFor,
  gridArea,
  newId,
  rowHeightFor,
  sanitizeHomeLayout,
  seedLayout,
  GRID_GAP,
  HOME_LAYOUT_KEY,
  type Block,
  type BlockAlign,
  type BlockColor,
  type BlockSize,
  type BlockType,
  type Device,
  type GridPos,
  type HomeLayout,
  type Section,
  type SectionBg,
} from "@/src/lib/home-layout";

// Конструктор главной страницы для суперадмина.
//   • обычный посетитель / выключенный режим → чистый рендер сетки;
//   • суперадмин + режим редактирования (тумблер в Настройках) → drag/resize
//     блоков, добавление текста/картинок/кнопок, отдельная раскладка под телефон.
// Сохранение — в app_settings (ключ home_layout) через /api/admin/settings.

type Bands = { promos: ReactNode; catalog: ReactNode };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const HEADING_SIZE: Record<BlockSize, string> = {
  sm: "text-lg sm:text-xl",
  base: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
  xl: "text-3xl sm:text-4xl lg:text-5xl",
};
const TEXT_SIZE: Record<BlockSize, string> = {
  sm: "text-xs",
  base: "text-sm lg:text-base",
  lg: "text-base lg:text-lg",
  xl: "text-lg lg:text-xl",
};
const COLOR_CLASS: Record<BlockColor, string> = {
  dark: "text-dark",
  muted: "text-muted",
  coral: "text-coral",
  white: "text-white",
};
const ALIGN_TEXT: Record<BlockAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const ALIGN_ITEMS: Record<BlockAlign, string> = {
  left: "items-start",
  center: "items-center",
  right: "items-end",
};

const BLOCK_LABEL: Record<BlockType, string> = {
  heading: "Заголовок",
  text: "Текст",
  button: "Кнопка",
  image: "Фото",
};

const DEFAULT_SIZE: Record<BlockType, { d: { w: number; h: number }; m: { w: number; h: number } }> = {
  heading: { d: { w: 6, h: 2 }, m: { w: 4, h: 2 } },
  text: { d: { w: 6, h: 2 }, m: { w: 4, h: 3 } },
  button: { d: { w: 3, h: 1 }, m: { w: 4, h: 1 } },
  image: { d: { w: 4, h: 4 }, m: { w: 4, h: 4 } },
};

function bgClassFor(bg: SectionBg | undefined): string {
  if (bg === "dark") return "bg-dark text-white";
  if (bg === "cream") return "bg-cream";
  return "bg-white";
}

function nextY(blocks: Block[], device: Device): number {
  return blocks.reduce((m, b) => Math.max(m, b[device].y + b[device].h), 0);
}

async function persistLayout(layout: HomeLayout): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: HOME_LAYOUT_KEY, value: JSON.stringify(layout) }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return body.error || "Не удалось сохранить";
    }
    return null;
  } catch {
    return "Не удалось сохранить";
  }
}

// ─────────────────────────── содержимое блока ───────────────────────────

function BlockView({ block, editing }: { block: Block; editing: boolean }) {
  const align = block.align ?? "left";
  const size = block.size ?? "base";
  const wrap = `flex h-full w-full flex-col justify-center ${ALIGN_ITEMS[align]}`;

  if (block.type === "image") {
    if (!block.src) {
      // Пустую картинку показываем только в редакторе; публичному посетителю — ничего.
      return editing ? (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-black/25 bg-cream text-xs text-muted">
          Нет картинки
        </div>
      ) : null;
    }
    return (
      <div className="h-full w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.src} alt={block.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }

  if (block.type === "button") {
    const cls = `inline-flex items-center justify-center rounded px-5 py-2.5 text-sm font-semibold transition ${
      block.btnStyle === "outline"
        ? "border border-black/20 text-dark hover:bg-black/5"
        : "border border-dark bg-dark text-white hover:bg-dark/80"
    }`;
    const label = block.text || "Кнопка";
    return (
      <div className={wrap}>
        {editing ? (
          <span className={cls}>{label}</span>
        ) : (
          <Link href={block.href || "#"} className={cls}>
            {label}
          </Link>
        )}
      </div>
    );
  }

  const color = block.color ?? (block.type === "text" ? "muted" : "dark");
  const textCls =
    block.type === "heading"
      ? `font-display font-semibold tracking-tight leading-tight ${HEADING_SIZE[size]}`
      : `leading-7 ${TEXT_SIZE[size]}`;

  return (
    <div className={wrap}>
      <div className={`w-full ${textCls} ${COLOR_CLASS[color]} ${ALIGN_TEXT[align]}`} style={{ whiteSpace: "pre-line" }}>
        {block.text || (editing ? "Пустой текст" : "")}
      </div>
    </div>
  );
}

// ─────────────────────────── чтение (публично) ───────────────────────────

function cssVars(b: Block): CSSProperties {
  return {
    "--d-col": `${b.d.x + 1} / span ${b.d.w}`,
    "--d-row": `${b.d.y + 1} / span ${b.d.h}`,
    "--m-col": `${b.m.x + 1} / span ${b.m.w}`,
    "--m-row": `${b.m.y + 1} / span ${b.m.h}`,
  } as CSSProperties;
}

function ReadGrid({ blocks }: { blocks: Block[] }) {
  return (
    <div className="gc-grid">
      {blocks.map((b) => (
        <div key={b.id} className="gc-block" style={cssVars(b)}>
          <BlockView block={b} editing={false} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────── редактируемая сетка ───────────────────────────

type EditGridProps = {
  section: Section;
  device: Device;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBlockPos: (id: string, pos: GridPos) => void;
  onAddBlock: (type: BlockType) => void;
};

function EditGrid({ section, device, selectedId, onSelect, onBlockPos, onAddBlock }: EditGridProps) {
  const cols = colsFor(device);
  const rowH = rowHeightFor(device);
  const rows = (device === "d" ? section.rowsD : section.rowsM) ?? 6;
  const blocks = section.blocks ?? [];

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
    gridAutoRows: `minmax(${rowH}px, auto)`,
    gap: GRID_GAP,
    minHeight: rows * rowH + Math.max(0, rows - 1) * GRID_GAP,
    ...(device === "m" ? { maxWidth: 360, margin: "0 auto" } : {}),
  };

  function startDrag(e: ReactPointerEvent, block: Block, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    onSelect(block.id);

    const blockEl = (e.currentTarget as HTMLElement).closest("[data-gc-block]") as HTMLElement | null;
    const gridEl = blockEl?.parentElement as HTMLElement | null;
    if (!gridEl) return;

    const rect = gridEl.getBoundingClientRect();
    const stepX = (rect.width - GRID_GAP * (cols - 1)) / cols + GRID_GAP;
    const stepY = rowH + GRID_GAP;
    const start = block[device];
    const sx = e.clientX;
    const sy = e.clientY;

    function onMove(ev: PointerEvent) {
      const dc = Math.round((ev.clientX - sx) / stepX);
      const dr = Math.round((ev.clientY - sy) / stepY);
      if (mode === "move") {
        onBlockPos(block.id, {
          x: clamp(start.x + dc, 0, cols - start.w),
          y: clamp(start.y + dr, 0, 500),
          w: start.w,
          h: start.h,
        });
      } else {
        onBlockPos(block.id, {
          x: start.x,
          y: start.y,
          w: clamp(start.w + dc, 1, cols - start.x),
          h: clamp(start.h + dr, 1, 50),
        });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div>
      <div style={gridStyle} className="rounded border border-dashed border-black/15 bg-black/[0.015] p-1">
        {blocks.map((b) => {
          const selected = b.id === selectedId;
          return (
            <div
              key={b.id}
              data-gc-block
              onPointerDown={(e) => startDrag(e, b, "move")}
              style={{ ...gridArea(b[device]), position: "relative", touchAction: "none" }}
              className={`cursor-move select-none ${
                selected ? "outline outline-2 outline-coral" : "outline-dashed outline-1 outline-black/25"
              }`}
            >
              <div className="pointer-events-none h-full w-full">
                <BlockView block={b} editing />
              </div>
              {selected ? (
                <div
                  onPointerDown={(e) => startDrag(e, b, "resize")}
                  className="absolute -bottom-1.5 -right-1.5 z-10 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-coral shadow"
                  title="Потяни, чтобы изменить размер"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Добавить в эту секцию:</span>
        {(["text", "heading", "button", "image"] as BlockType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onAddBlock(t)}
            className="rounded border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-dark transition hover:border-coral hover:text-coral"
          >
            ＋ {BLOCK_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── степпер ───────────────────────────

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-1 rounded border border-black/10 bg-white px-2 py-1">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(clamp(value - 1, min, max))} className="size-5 rounded border border-black/15 text-xs leading-none hover:bg-black/5">
          −
        </button>
        <span className="w-5 text-center text-xs font-bold text-dark">{value}</span>
        <button type="button" onClick={() => onChange(clamp(value + 1, min, max))} className="size-5 rounded border border-black/15 text-xs leading-none hover:bg-black/5">
          +
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── панель блока ───────────────────────────

type InspectorProps = {
  block: Block;
  device: Device;
  onChange: (patch: Partial<Block>) => void;
  onPos: (pos: GridPos) => void;
  onDelete: () => void;
  onClose: () => void;
};

function Inspector({ block, device, onChange, onPos, onDelete, onClose }: InspectorProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cols = colsFor(device);
  const pos = block[device];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "site");
      body.append("slug", "home");
      const res = await fetch("/api/admin/upload-image", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Ошибка загрузки");
      onChange({ src: json.url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const isTextual = block.type === "text" || block.type === "heading" || block.type === "button";

  return (
    <div className="print-hidden fixed bottom-4 left-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-black/15 bg-white p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-coral">{BLOCK_LABEL[block.type]}</p>
        <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-dark">
          ×
        </button>
      </div>

      {isTextual ? (
        <textarea
          value={block.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={block.type === "button" ? "Подпись кнопки" : "Текст"}
          className="mb-2 min-h-16 w-full resize-y border border-black/10 bg-cream px-2 py-1.5 text-sm text-dark outline-none focus:border-coral"
        />
      ) : null}

      {block.type === "button" ? (
        <input
          value={block.href ?? ""}
          onChange={(e) => onChange({ href: e.target.value })}
          placeholder="Ссылка, напр. /catalog"
          className="mb-2 w-full border border-black/10 bg-cream px-2 py-1.5 text-xs text-dark outline-none focus:border-coral"
        />
      ) : null}

      {block.type === "image" ? (
        <div className="mb-2 grid gap-1.5">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded border border-dashed border-black/25 bg-cream px-3 py-2 text-xs font-semibold text-muted transition hover:bg-coral-light hover:text-dark disabled:opacity-50"
          >
            {uploading ? "Загружается…" : block.src ? "Заменить фото" : "Загрузить фото"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
          {uploadError ? <p className="text-xs font-semibold text-burgundy">{uploadError}</p> : null}
          <input
            value={block.alt ?? ""}
            onChange={(e) => onChange({ alt: e.target.value })}
            placeholder="Описание (alt)"
            className="w-full border border-black/10 bg-cream px-2 py-1.5 text-xs text-dark outline-none focus:border-coral"
          />
        </div>
      ) : null}

      {/* выравнивание */}
      {block.type !== "image" ? (
        <div className="mb-2 flex gap-1">
          {(["left", "center", "right"] as BlockAlign[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ align: a })}
              className={`flex-1 rounded border py-1 text-xs font-semibold ${
                (block.align ?? "left") === a ? "border-coral bg-coral text-white" : "border-black/15 text-dark hover:bg-black/5"
              }`}
            >
              {a === "left" ? "◀" : a === "center" ? "▬" : "▶"}
            </button>
          ))}
        </div>
      ) : null}

      {/* размер и цвет для текста */}
      {block.type === "text" || block.type === "heading" ? (
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <select
            value={block.size ?? "base"}
            onChange={(e) => onChange({ size: e.target.value as BlockSize })}
            className="border border-black/10 bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-coral"
          >
            <option value="sm">Мелкий</option>
            <option value="base">Обычный</option>
            <option value="lg">Крупный</option>
            <option value="xl">Очень крупный</option>
          </select>
          <select
            value={block.color ?? (block.type === "text" ? "muted" : "dark")}
            onChange={(e) => onChange({ color: e.target.value as BlockColor })}
            className="border border-black/10 bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-coral"
          >
            <option value="dark">Тёмный</option>
            <option value="muted">Серый</option>
            <option value="coral">Коралловый</option>
            <option value="white">Белый</option>
          </select>
        </div>
      ) : null}

      {block.type === "button" ? (
        <div className="mb-2 flex gap-1">
          {(["solid", "outline"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ btnStyle: s })}
              className={`flex-1 rounded border py-1 text-xs font-semibold ${
                (block.btnStyle ?? "solid") === s ? "border-coral bg-coral text-white" : "border-black/15 text-dark hover:bg-black/5"
              }`}
            >
              {s === "solid" ? "Заливка" : "Контур"}
            </button>
          ))}
        </div>
      ) : null}

      {/* точная позиция для активного устройства */}
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <Stepper label="↔ X" value={pos.x} min={0} max={cols - pos.w} onChange={(x) => onPos({ ...pos, x })} />
        <Stepper label="↕ Y" value={pos.y} min={0} max={500} onChange={(y) => onPos({ ...pos, y })} />
        <Stepper label="Шир" value={pos.w} min={1} max={cols - pos.x} onChange={(w) => onPos({ ...pos, w })} />
        <Stepper label="Выс" value={pos.h} min={1} max={50} onChange={(h) => onPos({ ...pos, h })} />
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="w-full rounded border border-burgundy/40 bg-white py-1.5 text-xs font-semibold text-burgundy transition hover:bg-burgundy hover:text-white"
      >
        Удалить блок
      </button>
    </div>
  );
}

// ─────────────────────────── основной компонент ───────────────────────────

export function HomeBuilder({
  isSuperAdmin,
  initialLayout,
  bands,
}: {
  isSuperAdmin: boolean;
  initialLayout: HomeLayout;
  bands: Bands;
}) {
  const router = useRouter();
  const editMode = useSiteEditFlag() && isSuperAdmin;

  const [layout, setLayout] = useState<HomeLayout>(initialLayout);
  const [device, setDevice] = useState<Device>("d");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mutateSections(fn: (sections: Section[]) => Section[]) {
    setLayout((prev) => ({ ...prev, sections: fn(prev.sections) }));
    setDirty(true);
    setSaved(false);
  }

  function updateBlockPos(sectionId: string, blockId: string, pos: GridPos) {
    mutateSections((sections) =>
      sections.map((s) =>
        s.id !== sectionId ? s : { ...s, blocks: (s.blocks ?? []).map((b) => (b.id !== blockId ? b : { ...b, [device]: pos })) },
      ),
    );
  }

  function updateBlock(sectionId: string, blockId: string, patch: Partial<Block>) {
    mutateSections((sections) =>
      sections.map((s) =>
        s.id !== sectionId ? s : { ...s, blocks: (s.blocks ?? []).map((b) => (b.id !== blockId ? b : { ...b, ...patch })) },
      ),
    );
  }

  function addBlock(sectionId: string, type: BlockType) {
    const section = layout.sections.find((s) => s.id === sectionId);
    if (!section || section.type !== "grid") return;
    const blocks = section.blocks ?? [];
    const size = DEFAULT_SIZE[type];
    const nb: Block = {
      id: newId(),
      type,
      text: type === "image" ? undefined : type === "button" ? "Кнопка" : "Текст",
      href: type === "button" ? "/catalog" : undefined,
      align: "left",
      color: type === "text" ? "muted" : "dark",
      size: type === "heading" ? "lg" : "base",
      btnStyle: type === "button" ? "solid" : undefined,
      d: { x: 0, y: nextY(blocks, "d"), w: size.d.w, h: size.d.h },
      m: { x: 0, y: nextY(blocks, "m"), w: size.m.w, h: size.m.h },
    };
    mutateSections((sections) => sections.map((s) => (s.id === sectionId ? { ...s, blocks: [...(s.blocks ?? []), nb] } : s)));
    setSelectedId(nb.id);
  }

  function deleteBlock(sectionId: string, blockId: string) {
    mutateSections((sections) =>
      sections.map((s) => (s.id !== sectionId ? s : { ...s, blocks: (s.blocks ?? []).filter((b) => b.id !== blockId) })),
    );
    setSelectedId(null);
  }

  function moveSection(id: string, dir: -1 | 1) {
    mutateSections((sections) => {
      const i = sections.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= sections.length) return sections;
      const copy = sections.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function updateSection(id: string, patch: Partial<Section>) {
    mutateSections((sections) => sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function deleteSection(id: string) {
    if (!window.confirm("Удалить эту секцию?")) return;
    mutateSections((sections) => sections.filter((s) => s.id !== id));
    setSelectedId(null);
  }

  function addSection() {
    mutateSections((sections) => [...sections, { id: newId("s"), type: "grid", bg: "white", rowsD: 5, rowsM: 6, blocks: [] }]);
  }

  async function save(next?: HomeLayout) {
    const target = next ?? layout;
    setSaving(true);
    setError(null);
    const err = await persistLayout(target);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setDirty(false);
    setSaved(true);
    // Приводим локальное состояние к тому, что реально сохранится после серверной санитизации,
    // чтобы редактор не расходился с персистентной раскладкой после router.refresh().
    setLayout(sanitizeHomeLayout(target));
    router.refresh();
  }

  function disableBuilder() {
    if (!window.confirm("Выключить конструктор? Главная вернётся к обычному виду. Сохранённая раскладка не удалится.")) return;
    const next = { ...layout, enabled: false };
    setLayout(next);
    void save(next);
  }

  // Конструктор выключили — прячем сетку сразу (иначе она висит до конца router.refresh).
  if (!layout.enabled) return null;

  const selected = (() => {
    if (!selectedId) return null;
    for (const s of layout.sections) {
      const b = (s.blocks ?? []).find((x) => x.id === selectedId);
      if (b) return { sectionId: s.id, block: b };
    }
    return null;
  })();

  const sections = editMode ? layout.sections : layout.sections.filter((s) => !s.hidden);

  return (
    <main className="text-dark">
      {sections.map((section, index) => {
        const isBand = section.type !== "grid";
        const dim = editMode && section.hidden ? "opacity-40" : "";

        // Публичный рендер полосы (промо/каталог) — без обёртки, компонент сам себе секция.
        if (!editMode && isBand) {
          return <div key={section.id}>{bands[section.type as "promos" | "catalog"]}</div>;
        }

        const content = isBand ? (
          bands[section.type as "promos" | "catalog"]
        ) : editMode ? (
          <div className="mx-auto max-w-7xl">
            <EditGrid
              section={section}
              device={device}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBlockPos={(bid, pos) => updateBlockPos(section.id, bid, pos)}
              onAddBlock={(t) => addBlock(section.id, t)}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-7xl">
            <ReadGrid blocks={section.blocks ?? []} />
          </div>
        );

        const padded = isBand ? content : <div className="px-5 py-10 lg:px-8 lg:py-14">{content}</div>;

        if (!editMode) {
          return (
            <section key={section.id} className={`border-b border-black/10 ${bgClassFor(section.bg)}`}>
              {padded}
            </section>
          );
        }

        return (
          <section key={section.id} className={`relative border-b border-black/10 ${bgClassFor(section.bg)} ${dim}`}>
            {/* панель управления секцией */}
            <div className="print-hidden absolute right-2 top-2 z-20 flex flex-wrap items-center gap-1 rounded border border-black/15 bg-white/95 px-1.5 py-1 shadow">
              <span className="px-1 text-[11px] font-bold text-muted">
                {section.type === "grid" ? "Сетка" : section.type === "promos" ? "Акции" : "Каталог"}
              </span>
              <button type="button" onClick={() => moveSection(section.id, -1)} disabled={index === 0} className="size-6 rounded border border-black/15 text-xs disabled:opacity-30 hover:bg-black/5" title="Выше">
                ↑
              </button>
              <button type="button" onClick={() => moveSection(section.id, 1)} disabled={index === sections.length - 1} className="size-6 rounded border border-black/15 text-xs disabled:opacity-30 hover:bg-black/5" title="Ниже">
                ↓
              </button>
              <button type="button" onClick={() => updateSection(section.id, { hidden: !section.hidden })} className="size-6 rounded border border-black/15 text-xs hover:bg-black/5" title={section.hidden ? "Показать" : "Скрыть"}>
                {section.hidden ? "🙈" : "👁"}
              </button>
              {section.type === "grid" ? (
                <>
                  <button
                    type="button"
                    onClick={() => updateSection(section.id, { bg: section.bg === "white" ? "cream" : section.bg === "cream" ? "dark" : "white" })}
                    className="size-6 rounded border border-black/15 text-xs hover:bg-black/5"
                    title="Фон секции"
                  >
                    🎨
                  </button>
                  <button type="button" onClick={() => deleteSection(section.id)} className="size-6 rounded border border-burgundy/40 text-xs text-burgundy hover:bg-burgundy hover:text-white" title="Удалить секцию">
                    🗑
                  </button>
                </>
              ) : null}
            </div>
            {padded}
          </section>
        );
      })}

      {/* верхняя панель конструктора */}
      {editMode ? (
        <div className="print-hidden fixed left-1/2 top-3 z-50 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-full border border-black/15 bg-white px-2 py-1.5 shadow-xl">
          <span className="px-1.5 text-xs font-extrabold text-coral">Конструктор</span>
          <div className="flex overflow-hidden rounded-full border border-black/15">
            <button type="button" onClick={() => setDevice("d")} className={`px-3 py-1 text-xs font-semibold ${device === "d" ? "bg-dark text-white" : "text-dark hover:bg-black/5"}`}>
              🖥 Комп
            </button>
            <button type="button" onClick={() => setDevice("m")} className={`px-3 py-1 text-xs font-semibold ${device === "m" ? "bg-dark text-white" : "text-dark hover:bg-black/5"}`}>
              📱 Тел
            </button>
          </div>
          <button type="button" onClick={addSection} className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-dark hover:bg-black/5">
            ＋ Секция
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="rounded-full border border-coral bg-coral px-4 py-1 text-xs font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : saved && !dirty ? "Сохранено ✓" : "Сохранить"}
          </button>
          <button type="button" onClick={disableBuilder} className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-muted hover:bg-black/5">
            Выключить
          </button>
          {error ? <span className="w-full text-center text-xs font-semibold text-burgundy">{error}</span> : null}
        </div>
      ) : null}

      {/* панель выбранного блока */}
      {editMode && selected ? (
        <Inspector
          block={selected.block}
          device={device}
          onChange={(patch) => updateBlock(selected.sectionId, selected.block.id, patch)}
          onPos={(pos) => updateBlockPos(selected.sectionId, selected.block.id, pos)}
          onDelete={() => deleteBlock(selected.sectionId, selected.block.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </main>
  );
}

// ─────────────────────────── кнопка включения (на классической главной) ───────────────────────────

export function EnableBuilderGate({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const editMode = useSiteEditFlag() && isSuperAdmin;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editMode) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    const err = await persistLayout(seedLayout());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.refresh();
  }

  return (
    <div className="print-hidden fixed bottom-40 right-4 z-50 flex flex-col items-end gap-2">
      {error ? <p className="max-w-60 border border-burgundy bg-white px-3 py-2 text-xs font-semibold text-burgundy shadow-lg">{error}</p> : null}
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="flex items-center gap-2 rounded border border-dark bg-white px-4 py-2.5 text-sm font-bold text-dark shadow-lg transition hover:bg-black/5 disabled:opacity-50"
        title="Включить конструктор сетки для главной страницы"
      >
        <span aria-hidden>⊞</span>
        {busy ? "Включаю…" : "Включить конструктор главной"}
      </button>
    </div>
  );
}
