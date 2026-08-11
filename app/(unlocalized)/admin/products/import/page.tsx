"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";

type FieldChange = { field: string; label: string; from: unknown; to: unknown };
type ProductChange = { id: string; name: string; changes: FieldChange[] };
type CatalogDiff = {
  changes: ProductChange[];
  toArchive: { id: string; name: string }[];
  unknownRows: { rowNumber: number; id: string }[];
  warnings: string[];
  fileRowCount: number;
};

function short(value: unknown): string {
  const s = String(value ?? "");
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

export default function ImportCatalogPage() {
  const [file, setFile] = useState<File | null>(null);
  const [diff, setDiff] = useState<CatalogDiff | null>(null);
  const [archiveMissing, setArchiveMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; archived: number; failed: string[] } | null>(null);

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0] ?? null);
    setDiff(null);
    setResult(null);
    setError(null);
  }

  async function preview() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/products/import/preview", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { diff?: CatalogDiff; error?: string };
      if (!res.ok || !data.diff) {
        setError(data.error ?? "Не удалось прочитать файл");
      } else {
        setDiff(data.diff);
      }
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      if (archiveMissing) body.append("archiveMissing", "1");
      const res = await fetch("/api/admin/products/import/apply", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        updated?: number;
        archived?: number;
        failed?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Не удалось применить");
      } else {
        setResult({ updated: data.updated ?? 0, archived: data.archived ?? 0, failed: data.failed ?? [] });
        setDiff(null);
      }
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  const nothingToDo = diff && diff.changes.length === 0 && diff.toArchive.length === 0;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/products" className="text-sm font-semibold text-coral hover:text-coral-hover">← Товары</Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Загрузить каталог из Excel</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Правьте файл из «Выгрузить каталог» (цена, состав, описание, остаток, мин/шаг, архив). Сначала —
        предпросмотр изменений, применяются только после подтверждения. <b>id и slug менять нельзя.</b>
      </p>

      <div className="mt-6 rounded-card border border-black/10 bg-white p-5">
        <input type="file" accept=".xlsx" onChange={onPick} className="block w-full text-sm" />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={preview}
            disabled={!file || busy}
            className="rounded border border-dark bg-dark px-4 py-2.5 text-sm font-bold text-white transition hover:bg-dark/90 disabled:opacity-50"
          >
            {busy && !diff ? "Читаю…" : "Проверить изменения"}
          </button>
          {file ? <span className="text-xs text-muted">{file.name}</span> : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm font-semibold text-burgundy">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-card border border-green-500/40 bg-green-50 p-5 text-sm">
          <p className="font-bold text-dark">Готово ✓</p>
          <p className="mt-1 text-dark">Обновлено товаров: {result.updated}. В архив: {result.archived}.</p>
          {result.failed.length > 0 ? (
            <p className="mt-1 text-burgundy">Не удалось: {result.failed.join(", ")}</p>
          ) : null}
          <Link href="/admin/products" className="mt-3 inline-block font-semibold text-coral hover:text-coral-hover">
            К товарам →
          </Link>
        </div>
      ) : null}

      {diff ? (
        <div className="mt-5 space-y-4">
          {diff.warnings.map((w, i) => (
            <p key={i} className="rounded-md bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">⚠️ {w}</p>
          ))}

          {nothingToDo ? (
            <p className="rounded-card border border-black/10 bg-white p-5 text-sm text-muted">
              Изменений нет — файл совпадает с текущим каталогом.
            </p>
          ) : null}

          {diff.changes.length > 0 ? (
            <div className="overflow-hidden rounded-card border border-black/10 bg-white">
              <div className="border-b border-black/10 p-4">
                <h2 className="font-display text-lg font-semibold">Изменения ({diff.changes.length})</h2>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-black/5">
                {diff.changes.map((change) => (
                  <div key={change.id} className="p-4">
                    <p className="text-sm font-bold text-dark">{change.name}</p>
                    <ul className="mt-1 space-y-0.5">
                      {change.changes.map((fieldChange) => (
                        <li key={fieldChange.field} className="text-xs text-muted">
                          <span className="font-semibold text-dark">{fieldChange.label}:</span>{" "}
                          <span className="text-burgundy line-through">{short(fieldChange.from)}</span>{" → "}
                          <span className="font-semibold text-green-700">{short(fieldChange.to)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {diff.toArchive.length > 0 ? (
            <div className="rounded-card border border-amber-400/40 bg-amber-50 p-5">
              <p className="text-sm font-bold text-dark">Пропали из файла: {diff.toArchive.length} товар(ов)</p>
              <p className="mt-1 text-xs text-muted">
                {diff.toArchive.map((p) => p.name).join(", ")}
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-dark">
                <input type="checkbox" checked={archiveMissing} onChange={(e) => setArchiveMissing(e.currentTarget.checked)} />
                Отправить их в архив (не удаляем, обратимо)
              </label>
            </div>
          ) : null}

          {!nothingToDo ? (
            <button
              type="button"
              onClick={apply}
              disabled={busy}
              className="rounded border border-coral bg-coral px-6 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
            >
              {busy ? "Применяю…" : "Применить изменения"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
