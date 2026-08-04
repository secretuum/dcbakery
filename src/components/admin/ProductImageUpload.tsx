"use client";

import { useRef, useState } from "react";
import { ImageCropper } from "./ImageCropper";

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [broken, setBroken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = urlValue.trim();
  const changed = trimmed !== defaultValue.trim();
  const hasImage = Boolean(trimmed) && !broken;

  // Выбор файла → открываем кадратор (загружается уже обрезанный результат).
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // чтобы можно было выбрать тот же файл повторно
    if (!file) return;
    setError(null);
    setPendingFile(file);
  }

  async function uploadBlob(blob: Blob) {
    setPendingFile(null);
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", new File([blob], `${slug ?? "new"}.png`, { type: "image/png" }));
      body.append("slug", slug ?? "new");

      const res = await fetch("/api/admin/upload-image", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }

      setBroken(false);
      setUrlValue(json.url ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  // Отправляем ту же форму товара, что и основная кнопка «Сохранить»
  // (все поля привязаны через form={formId}); _action пустой → серверный экшен
  // трактует его как "save".
  function saveNow() {
    if (!form) return;
    const el = document.getElementById(form);
    if (el instanceof HTMLFormElement) {
      el.requestSubmit();
    }
  }

  return (
    <div className="mt-2 grid gap-2">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trimmed}
          alt="Превью фото товара"
          onError={() => setBroken(true)}
          className="h-20 w-20 rounded-btn border border-black/10 bg-cream object-cover"
        />
      ) : null}
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="min-h-9 rounded-btn border border-dashed border-black/20 bg-cream px-3 py-2 text-xs font-semibold text-muted transition hover:bg-coral-light hover:text-dark disabled:opacity-50"
      >
        {uploading ? "Загружается..." : hasImage ? "Заменить фото" : "Загрузить фото"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      {error ? <p className="text-xs font-semibold text-burgundy">{error}</p> : null}
      <input
        className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-medium text-muted outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
        placeholder="или вставить URL вручную"
        value={urlValue}
        onChange={(e) => {
          setBroken(false);
          setUrlValue(e.target.value);
        }}
        form={form}
        name={inputName}
      />
      {changed ? (
        <div className="flex flex-wrap items-center gap-2 rounded-btn border border-burgundy/30 bg-coral-light px-3 py-2">
          <span className="text-xs font-bold text-burgundy">Фото изменено — не сохранено</span>
          {form ? (
            <button
              type="button"
              onClick={saveNow}
              className="min-h-8 rounded-btn border border-coral bg-coral px-3 py-1 text-xs font-bold text-white transition hover:bg-coral-hover"
            >
              Сохранить сейчас
            </button>
          ) : (
            <span className="text-xs font-medium text-burgundy">не забудьте сохранить товар</span>
          )}
        </div>
      ) : null}
      {pendingFile ? (
        <ImageCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onCropped={(blob) => void uploadBlob(blob)}
        />
      ) : null}
    </div>
  );
}
