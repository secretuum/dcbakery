"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";

type PromoInitial = {
  enabled: boolean;
  label: string;
  activeUntil: string | null;
  count: number;
};

type ApplyResult = {
  count: number;
  enabled: boolean;
  applied?: number;
  unchanged?: number;
  higher?: number;
  notFound?: number;
};

type SmartItem = {
  id: string;
  name: string;
  matchedName: string;
  oldPrice: number;
  price: number;
  discount: number;
  belowBase: boolean;
};

type SmartPreview = { items: SmartItem[]; unmatched: string[]; discountCount: number };

const fmt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

/** Стилизованная кнопка выбора файла (нативный input невидим/уродлив). */
function FilePicker({
  onPick,
  file,
  label = "Выбрать файл",
}: {
  onPick: (f: File | null) => void;
  file: File | null;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border-[1.5px] border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-dark transition hover:bg-cream">
        <input
          type="file"
          accept=".xlsx,.csv,.txt"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onPick(e.currentTarget.files?.[0] ?? null)}
          className="sr-only"
        />
        📄 {label}
      </label>
      <span className="text-xs text-muted">{file ? file.name : "файл не выбран"}</span>
    </div>
  );
}

export function PromoManager({ initial }: { initial: PromoInitial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [label, setLabel] = useState(initial.label || "Скидка до 50% на всё до конца августа");
  const [activeUntil, setActiveUntil] = useState(initial.activeUntil ?? "");
  const [count, setCount] = useState(initial.count);
  const [error, setError] = useState<string | null>(null);

  // Обычная загрузка (файл в формате «Выгрузить каталог»)
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);

  // Умная загрузка (любой файл + ИИ)
  const [smartFile, setSmartFile] = useState<File | null>(null);
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartPreview, setSmartPreview] = useState<SmartPreview | null>(null);

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
      if (!res.ok) setError(data.error ?? "Не удалось сохранить");
      else {
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
        setSmartPreview(null);
      }
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeSmart() {
    if (!smartFile) return;
    setSmartBusy(true);
    setError(null);
    setSmartPreview(null);
    try {
      const body = new FormData();
      body.append("file", smartFile);
      const res = await fetch("/api/admin/products/promo/smart-preview", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as SmartPreview & { error?: string };
      if (!res.ok) setError(data.error ?? "Не удалось проанализировать");
      else setSmartPreview({ items: data.items ?? [], unmatched: data.unmatched ?? [], discountCount: data.discountCount ?? 0 });
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setSmartBusy(false);
    }
  }

  async function applySmart() {
    if (!smartPreview) return;
    setSmartBusy(true);
    setError(null);
    setResult(null);
    try {
      const pricesJson = JSON.stringify(
        Object.fromEntries(smartPreview.items.map((i) => [i.id, i.price])),
      );
      const body = new FormData();
      body.append("action", "apply");
      body.append("enabled", "1"); // применяем промо → сразу показываем на сайте
      body.append("label", label);
      body.append("activeUntil", activeUntil);
      body.append("pricesJson", pricesJson);
      const res = await fetch("/api/admin/products/promo/apply", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as ApplyResult & { error?: string };
      if (!res.ok) setError(data.error ?? "Не удалось применить");
      else {
        setResult(data);
        setCount(data.count);
        setEnabled(true);
        setSmartPreview(null);
        setSmartFile(null);
      }
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setSmartBusy(false);
    }
  }

  const busyAny = busy || smartBusy;

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-card border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-dark">
          Сейчас: акция {enabled ? <span className="text-green-700">включена</span> : <span className="text-muted">выключена</span>},
          товаров со скидкой: <b>{count}</b>
          {activeUntil ? <> · до {activeUntil}</> : null}
        </p>
      </div>

      {/* Общие настройки */}
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
      </div>

      {/* УМНАЯ ЗАГРУЗКА */}
      <div className="rounded-card border-[1.5px] border-coral/40 bg-coral-light/40 p-5 space-y-3">
        <div>
          <h2 className="text-base font-bold text-dark">🤖 Умная загрузка (любой файл)</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Пришлите <b>любой</b> прайс — хоть «название десерта — новая цена», хоть выгрузку из 1С.
            ИИ сам сопоставит позиции с каталогом. Не нужен точный формат.
          </p>
        </div>
        <FilePicker onPick={setSmartFile} file={smartFile} label="Выбрать прайс" />
        <button
          type="button"
          onClick={analyzeSmart}
          disabled={!smartFile || busyAny}
          className="rounded border border-dark bg-dark px-5 py-2.5 text-sm font-bold text-white transition hover:bg-dark/90 disabled:opacity-50"
        >
          {smartBusy && !smartPreview ? "Анализирую…" : "Проанализировать"}
        </button>

        {smartPreview ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-card border border-black/10 bg-white">
              <div className="flex items-center justify-between border-b border-black/10 p-3">
                <h3 className="text-sm font-bold">Сопоставлено: {smartPreview.items.length} · со скидкой: {smartPreview.discountCount}</h3>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-black/5">
                {smartPreview.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-dark">{it.name}</p>
                      <p className="truncate text-xs text-muted">из файла: «{it.matchedName}»</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-muted line-through">{fmt(it.oldPrice)}</span>{" "}
                      <span className={`font-bold ${it.belowBase ? "text-coral" : "text-muted"}`}>{fmt(it.price)}</span>
                      {it.belowBase ? (
                        <span className="ml-1 rounded-full bg-coral px-1.5 py-0.5 text-[11px] font-bold text-white">−{it.discount}%</span>
                      ) : (
                        <span className="ml-1 text-[11px] text-muted">не ниже — не покажется</span>
                      )}
                    </div>
                  </div>
                ))}
                {smartPreview.items.length === 0 ? (
                  <p className="p-3 text-sm text-muted">Ни одной позиции не удалось сопоставить с каталогом.</p>
                ) : null}
              </div>
            </div>

            {smartPreview.unmatched.length > 0 ? (
              <details className="rounded-card border border-amber-400/40 bg-amber-50 p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-dark">
                  Не распознано: {smartPreview.unmatched.length} строк(и)
                </summary>
                <ul className="mt-2 space-y-0.5 text-xs text-muted">
                  {smartPreview.unmatched.slice(0, 50).map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            <button
              type="button"
              onClick={applySmart}
              disabled={busyAny || smartPreview.discountCount === 0}
              className="rounded border border-coral bg-coral px-6 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
            >
              {smartBusy ? "Применяю…" : `Применить и включить акцию (${smartPreview.discountCount})`}
            </button>
          </div>
        ) : null}
      </div>

      {/* ОБЫЧНАЯ ЗАГРУЗКА (точный формат) */}
      <div className="rounded-card border border-black/10 bg-white p-5 space-y-3">
        <div>
          <h2 className="text-base font-bold text-dark">Загрузка по формату каталога</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Файл как «Выгрузить каталог» (
            <Link href="/api/admin/products/export" className="font-semibold text-coral hover:text-coral-hover">
              скачать текущий
            </Link>
            ), в колонке <b>price</b> — акционные цены. Берутся только цены <b>ниже текущей</b>.
          </p>
        </div>
        <FilePicker onPick={setFile} file={file} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busyAny}
            className="rounded border border-coral bg-coral px-6 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
          >
            {busy ? "Сохраняю…" : "Сохранить акцию"}
          </button>
          <button
            type="button"
            onClick={clearPromo}
            disabled={busyAny}
            className="rounded border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-dark transition hover:bg-cream disabled:opacity-50"
          >
            Выключить и очистить
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-semibold text-burgundy">{error}</p> : null}

      {result ? (
        <div className="rounded-card border border-green-500/40 bg-green-50 p-5 text-sm">
          <p className="font-bold text-dark">Готово ✓ Товаров со скидкой: {result.count}</p>
          {result.applied !== undefined ? (
            <p className="mt-1 text-dark">
              Применено скидок: {result.applied}.
              {result.unchanged ? ` Без изменений (= текущей): ${result.unchanged}.` : ""}
              {result.higher ? ` Цена выше текущей (пропущено): ${result.higher}.` : ""}
              {result.notFound ? ` Не найдено в каталоге: ${result.notFound}.` : ""}
            </p>
          ) : null}
          <Link href="/catalog" className="mt-2 inline-block font-semibold text-coral hover:text-coral-hover">
            Открыть каталог →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
