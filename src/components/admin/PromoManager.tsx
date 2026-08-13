"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";

type PromoInitial = {
  enabled: boolean;
  label: string;
  activeUntil: string | null;
  count: number;
};

type ApplyResult = { count: number; uploaded: number; skipped: number; enabled: boolean };

export function PromoManager({ initial }: { initial: PromoInitial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [label, setLabel] = useState(initial.label || "Скидка до 50% на всё до конца августа");
  const [activeUntil, setActiveUntil] = useState(initial.activeUntil ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [count, setCount] = useState(initial.count);

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("action", "apply");
      body.append("enabled", enabled ? "1" : "0");
      body.append("label", label);
      body.append("activeUntil", activeUntil);
      if (file) body.append("file", file);
      const res = await fetch("/api/admin/products/promo/apply", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as ApplyResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить");
      } else {
        setResult(data);
        setCount(data.count);
        setFile(null);
      }
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  async function clearPromo() {
    if (!confirm("Выключить акцию и убрать все промо-цены? Цены вернутся к базовым.")) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("action", "clear");
      const res = await fetch("/api/admin/products/promo/apply", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось выключить");
      } else {
        setEnabled(false);
        setCount(0);
        setResult(null);
      }
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-card border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-dark">
          Сейчас: акция {enabled ? <span className="text-green-700">включена</span> : <span className="text-muted">выключена</span>},
          товаров со скидкой: <b>{count}</b>
          {activeUntil ? <> · до {activeUntil}</> : null}
        </p>
      </div>

      <div className="rounded-card border border-black/10 bg-white p-5 space-y-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-dark">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />
          Показывать акцию на сайте
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-dark">Текст баннера / бейджа</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            maxLength={200}
            className="w-full rounded-md border-[1.5px] border-black/10 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-dark">Действует до (включительно)</span>
          <input
            type="date"
            value={activeUntil}
            onChange={(e) => setActiveUntil(e.currentTarget.value)}
            className="rounded-md border-[1.5px] border-black/10 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">После этой даты акция сама выключится. Пусто = без срока.</span>
        </label>

        <div>
          <span className="mb-1 block text-sm font-semibold text-dark">Файл промо-цен (.xlsx)</span>
          <input type="file" accept=".xlsx" onChange={onPick} className="block w-full text-sm" />
          <p className="mt-1.5 text-xs leading-5 text-muted">
            Тот же формат, что «Выгрузить каталог»:{" "}
            <Link href="/api/admin/products/export" className="font-semibold text-coral hover:text-coral-hover">
              скачать текущий каталог
            </Link>{" "}
            → в колонке <b>price</b> поставьте акционную цену → загрузите сюда. Берутся только цены
            <b> ниже базовой</b>. Без файла цены не меняются (можно менять только текст/дату/вкл-выкл).
          </p>
        </div>
      </div>

      {error ? <p className="text-sm font-semibold text-burgundy">{error}</p> : null}

      {result ? (
        <div className="rounded-card border border-green-500/40 bg-green-50 p-5 text-sm">
          <p className="font-bold text-dark">Сохранено ✓</p>
          <p className="mt-1 text-dark">
            Товаров со скидкой: {result.count}.
            {result.uploaded > 0 ? ` Из файла принято: ${result.uploaded}.` : ""}
            {result.skipped > 0 ? ` Пропущено (нет id / цена не ниже базовой): ${result.skipped}.` : ""}
          </p>
          <Link href="/catalog" className="mt-2 inline-block font-semibold text-coral hover:text-coral-hover">
            Открыть каталог →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded border border-coral bg-coral px-6 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
        >
          {busy ? "Сохраняю…" : "Сохранить акцию"}
        </button>
        <button
          type="button"
          onClick={clearPromo}
          disabled={busy}
          className="rounded border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-dark transition hover:bg-cream disabled:opacity-50"
        >
          Выключить и очистить
        </button>
      </div>
    </div>
  );
}
