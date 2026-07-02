"use client";

import { useRef, useState } from "react";

type Props = {
  defaultValue?: string;
  form?: string;
  inputName?: string;
  slug?: string;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BUCKET = "product-images";

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
      const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
      const path = `products/${slug ?? "new"}_${Date.now()}.${ext}`;
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(json.message ?? json.error ?? res.statusText);
      }

      setUrlValue(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`);
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
