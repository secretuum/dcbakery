"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SiteContent } from "@/src/lib/site-content";

// Режим «редактирование сайта» для суперадмина: плавающая кнопка-тумблер
// и карандашики у редактируемых текстов. Сохранение — в app_settings
// через /api/admin/settings (ключ site_content), затем router.refresh().

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
  const [editMode, setEditMode] = useState(false);
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

      {/* Плавающий тумблер режима редактирования */}
      <div className="print-hidden fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
        {error && editMode ? (
          <p className="max-w-60 border border-burgundy bg-white px-3 py-2 text-xs font-semibold text-burgundy shadow-lg">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setEditMode((prev) => !prev)}
          className={`flex items-center gap-2 border px-4 py-2.5 text-sm font-bold shadow-lg transition ${
            editMode
              ? "border-coral bg-coral text-white"
              : "border-dark bg-dark text-white hover:bg-dark/85"
          }`}
        >
          <span aria-hidden>✎</span>
          {editMode ? "Редактирование: вкл" : "Редактировать сайт"}
        </button>
      </div>
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
