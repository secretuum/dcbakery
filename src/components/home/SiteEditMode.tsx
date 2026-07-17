"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SiteContent } from "@/src/lib/site-content";

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

type EditableField =
  | "contactWhatsapp"
  | "contactPhone"
  | "address"
  | "workHours"
  | "heroTitle"
  | "heroSubtitle"
  | "aboutTitle"
  | "aboutText";

type SiteEditContextValue = {
  content: SiteContent;
  editMode: boolean;
  save: (field: EditableField, value: string) => Promise<boolean>;
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
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);

  if (!isSuperAdmin) {
    return <>{children}</>;
  }

  async function save(field: EditableField, value: string) {
    const next = { ...content, [field]: value };
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

  return (
    <SiteEditContext.Provider value={{ content, editMode, save }}>
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

  const value = ctx ? ctx.content[field] : fallback;

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

  return (
    <span className={`relative inline-block outline-dashed outline-1 outline-coral/60 ${className ?? ""}`}>
      <span style={{ whiteSpace: "pre-line" }}>{value}</span>
      <button
        type="button"
        aria-label="Редактировать"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="absolute -right-3 -top-3 z-10 flex size-6 items-center justify-center rounded-full border border-coral bg-white text-xs text-coral shadow hover:bg-coral hover:text-white"
      >
        ✎
      </button>

      {open ? (
        <span className="absolute left-0 top-full z-50 mt-2 block w-72 max-w-[80vw] border border-black/15 bg-white p-3 text-left shadow-xl sm:w-96">
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
          </span>
        </span>
      ) : null}
    </span>
  );
}
