"use client";

import { useRef, useState } from "react";

type Props = {
  defaultValue?: string;
  form?: string;
  inputName?: string;
  slug?: string;
};

export function ProductImageUpload({ defaultValue = "", form, inputName = "image", slug }: Props) {
  const [urlValue, setUrlValue] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("slug", slug ?? "new");

      const res = await fetch("/api/admin/upload-image", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }

      setUrlValue(json.url ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 grid gap-2">
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="min-h-9 rounded-btn border border-dashed border-black/20 bg-cream px-3 py-2 text-xs font-black text-muted transition hover:bg-coral-light hover:text-dark disabled:opacity-50"
      >
        {uploading ? "Загружается..." : "Загрузить фото"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      {error ? <p className="text-xs font-bold text-burgundy">{error}</p> : null}
      <input
        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-muted outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
        placeholder="или вставить URL вручную"
        value={urlValue}
        onChange={(e) => setUrlValue(e.target.value)}
        form={form}
        name={inputName}
      />
    </div>
  );
}
