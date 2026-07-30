"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
// ВАЖНО: только тип (import type — стирается при сборке). site-content.ts помечен
// "server-only" и тянет admin.ts; импорт значения из него в этот КЛИЕНТСКИЙ модуль
// ломает сборку. Поэтому siteText определён локально ниже.
import type { SiteContent } from "@/src/lib/site-content";

/** Значение редактируемого текста по id: сохранённый override или запасной текст. */
function siteText(content: Record<string, unknown>, id: string, fallback: string): string {
  const value = content[id];
  return typeof value === "string" && value.trim() ? value : fallback;
}

// Режим «редактирование сайта» для суперадмина: включается тумблером
// в Админке → Настройки (хранится в localStorage), после чего у редактируемых
// текстов на страницах появляются карандашики. Сохранение — в app_settings
// через /api/admin/settings (ключ site_content), затем router.refresh().

export const SITE_EDIT_STORAGE_KEY = "dc_site_edit";

export function readSiteEditFlag() {
  try {
    return window.localStorage.getItem(SITE_EDIT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSiteEditFlag(enabled: boolean) {
  try {
    window.localStorage.setItem(SITE_EDIT_STORAGE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event("dc-site-edit-change"));
  } catch {
    // localStorage может быть недоступен — режим просто не включится
  }
}

function subscribeSiteEditFlag(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("dc-site-edit-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("dc-site-edit-change", callback);
  };
}

export function useSiteEditFlag() {
  return useSyncExternalStore(subscribeSiteEditFlag, readSiteEditFlag, () => false);
}

// Любой уникальный строковый id (не только фиксированные поля) — так редактируется
// «любая деталь» сайта: обернул текст в <EditableText field="уникальный.id" ...>.
type EditableField = string;

type SiteEditContextValue = {
  content: Record<string, unknown>;
  editMode: boolean;
  save: (field: EditableField, value: string) => Promise<boolean>;
  /** Сброс детали к первоначальному виду (убирает override). */
  reset: (field: EditableField) => Promise<boolean>;
};

const SiteEditContext = createContext<SiteEditContextValue | null>(null);

type ProviderProps = {
  isSuperAdmin: boolean;
  content: SiteContent;
  children: ReactNode;
};

export function SiteEditProvider({ isSuperAdmin, content: initialContent, children }: ProviderProps) {
  const router = useRouter();
  // Режим включается в Админке → Настройки; здесь только читаем флаг из localStorage
  const editMode = useSiteEditFlag() && isSuperAdmin;
  const [content, setContent] = useState<Record<string, unknown>>(initialContent);
  const [error, setError] = useState<string | null>(null);

  if (!isSuperAdmin) {
    return <>{children}</>;
  }

  async function persist(next: Record<string, unknown>) {
    setError(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "site_content", value: JSON.stringify(next) }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Не удалось сохранить");
      }

      setContent(next);
      router.refresh();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить");
      return false;
    }
  }

  async function save(field: EditableField, value: string) {
    return persist({ ...content, [field]: value });
  }

  // Сброс к первоначальному виду: убираем override-ключ → значение возвращается
  // к дефолту (defaultSiteContent) или к fallback-пропу компонента.
  async function reset(field: EditableField) {
    const next = { ...content };
    delete next[field];
    return persist(next);
  }

  return (
    <SiteEditContext.Provider value={{ content, editMode, save, reset }}>
      {children}

      {editMode ? (
        <div className="print-hidden fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
          {error ? (
            <p className="max-w-60 border border-burgundy bg-white px-3 py-2 text-xs font-semibold text-burgundy shadow-lg">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => writeSiteEditFlag(false)}
            className="flex items-center gap-2 border border-coral bg-coral px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-coral-hover"
            title="Выключить можно и здесь, и в Настройках"
          >
            <span aria-hidden>✎</span>
            Режим редактирования — выключить
          </button>
        </div>
      ) : null}
    </SiteEditContext.Provider>
  );
}

type EditableTextProps = {
  field: EditableField;
  /** Значение для рендера без суперадмина (серверное) */
  fallback: string;
  multiline?: boolean;
  className?: string;
};

export function EditableText({ field, fallback, multiline = false, className }: EditableTextProps) {
  const ctx = useContext(SiteEditContext);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const value = ctx ? siteText(ctx.content, field, fallback) : fallback;
  const hasStored =
    !!ctx && typeof ctx.content[field] === "string" && (ctx.content[field] as string).trim().length > 0;

  if (!ctx || !ctx.editMode) {
    return <span className={className} style={{ whiteSpace: "pre-line" }}>{value}</span>;
  }

  async function handleSave() {
    if (!ctx) return;
    setSaving(true);
    const ok = await ctx.save(field, draft.trim() || value);
    setSaving(false);
    if (ok) {
      setOpen(false);
    }
  }

  async function handleReset() {
    if (!ctx) return;
    setSaving(true);
    const ok = await ctx.reset(field);
    setSaving(false);
    if (ok) {
      setOpen(false);
    }
  }

  // Слой редактирования НЕ меняет раскладку: тот же inline-поток, что и обычный
  // текст (без inline-block и абсолютного карандаша, которые сдвигали текст в
  // скруглённых блоках). Подсветка — через outline (рисуется снаружи, не двигает
  // содержимое). Клик по самому тексту открывает редактор.
  return (
    <span
      role="button"
      tabIndex={0}
      title="Редактировать"
      onClick={(event) => {
        // Текст может быть внутри <Link>/<button> — гасим переход/сабмит.
        event.preventDefault();
        event.stopPropagation();
        setDraft(value);
        setOpen(true);
      }}
      className={`relative cursor-text rounded-[3px] outline outline-1 outline-dashed outline-coral/60 transition hover:outline-coral hover:outline-offset-1 ${className ?? ""}`}
      style={{ whiteSpace: "pre-line" }}
    >
      {value}

      {open ? (
        <span
          onClick={(event) => event.stopPropagation()}
          className="absolute left-0 top-full z-50 mt-2 block w-72 max-w-[80vw] cursor-auto rounded-md border border-black/15 bg-white p-3 text-left text-base font-normal normal-case leading-normal tracking-normal text-dark shadow-xl sm:w-96"
        >
          {multiline ? (
            <textarea
              className="min-h-28 w-full border border-black/10 bg-cream px-3 py-2 text-sm font-medium text-dark outline-none focus:border-coral"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              autoFocus
            />
          ) : (
            <input
              className="w-full border border-black/10 bg-cream px-3 py-2 text-sm font-medium text-dark outline-none focus:border-coral"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              autoFocus
            />
          )}
          <span className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="border border-coral bg-coral px-4 py-1.5 text-xs font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
            >
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border border-black/15 bg-white px-4 py-1.5 text-xs font-semibold text-dark hover:bg-black/5"
            >
              Отмена
            </button>
            {hasStored ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleReset}
                title="Вернуть первоначальный вид"
                className="ml-auto self-center text-xs font-semibold text-muted underline-offset-2 transition hover:text-burgundy hover:underline disabled:opacity-50"
              >
                Сбросить
              </button>
            ) : null}
          </span>
        </span>
      ) : null}
    </span>
  );
}

// ─────────────────────────── редактируемое изображение ───────────────────────────

type EditableImageProps = {
  /** Уникальный id override в site_content (URL картинки). */
  field: EditableField;
  /** Картинка по умолчанию (пока суперадмин не заменил). */
  fallbackSrc: string;
  alt?: string;
  className?: string;
  sizesHint?: string;
};

/**
 * Изображение, редактируемое суперадмином прямо на реальной странице: клик по фото
 * в режиме редактирования → «Заменить фото» (загрузка через /api/admin/upload-image)
 * или «Сбросить» (вернуть исходное). Override (URL) хранится в site_content по field.
 * Вне режима — обычный <img>, раскладка не меняется.
 */
export function EditableImage({ field, fallbackSrc, alt = "", className, sizesHint }: EditableImageProps) {
  const ctx = useContext(SiteEditContext);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const src = ctx ? siteText(ctx.content, field, fallbackSrc) : fallbackSrc;
  const hasStored =
    !!ctx && typeof ctx.content[field] === "string" && (ctx.content[field] as string).trim().length > 0;

  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={src} alt={alt} className={className} />;

  if (!ctx || !ctx.editMode) {
    return img;
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    if (!ctx) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "site");
      body.append("slug", "home");
      const res = await fetch("/api/admin/upload-image", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Ошибка загрузки");
      const ok = await ctx.save(field, json.url);
      if (ok) setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleReset() {
    if (!ctx) return;
    const ok = await ctx.reset(field);
    if (ok) setOpen(false);
  }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        title={sizesHint ?? "Заменить фото"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className="relative block h-full w-full cursor-pointer outline outline-2 outline-dashed outline-coral/70 transition hover:outline-coral"
      >
        {img}
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white shadow"
        >
          ✎ фото
        </span>
      </span>

      {open
        ? createPortal(
            <div
              className="print-hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-sm rounded-lg border border-black/15 bg-white p-4 shadow-2xl"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-coral">Изображение</p>
                  <button type="button" onClick={() => setOpen(false)} className="text-xl leading-none text-muted hover:text-dark">
                    ×
                  </button>
                </div>
                <div className="overflow-hidden rounded-md border border-black/10 bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="max-h-40 w-full object-contain" />
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFile}
                />
                {error ? <p className="mt-2 text-xs font-semibold text-burgundy">{error}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-md border border-coral bg-coral px-4 py-1.5 text-xs font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
                  >
                    {uploading ? "Загружается…" : "Заменить фото"}
                  </button>
                  {hasStored ? (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleReset}
                      className="rounded-md border border-black/15 bg-white px-4 py-1.5 text-xs font-semibold text-dark transition hover:bg-black/5 disabled:opacity-50"
                    >
                      Сбросить
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="ml-auto rounded-md px-3 py-1.5 text-xs font-semibold text-muted hover:text-dark"
                  >
                    Отмена
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-muted">JPG / PNG / WebP. Заменится только это фото.</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
