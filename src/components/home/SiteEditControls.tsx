"use client";

// Тяжёлый UI редактирования сайта, вынесенный из SiteEditMode.tsx (C1). Грузится
// отдельным чанком через next/dynamic ТОЛЬКО когда суперадмин включил режим правки —
// обычные посетители его не скачивают. Логика компонентов дословно перенесена из
// SiteEditMode (поведение не менялось), а общие хелперы/контекст импортируются оттуда.

import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/src/i18n/client";
import {
  SiteEditContext,
  siteText,
  parseTransform,
  transformStyle,
  transformKeyFor,
  isIdentityTransform,
  clampNum,
  DEFAULT_TRANSFORM,
  type ImgTransform,
  type EditableTextProps,
  type EditableImageProps,
} from "./SiteEditMode";

export function EditableTextControl({ field, fallback, multiline = false, className }: EditableTextProps) {
  const ctx = useContext(SiteEditContext);
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Текст хранится ОТДЕЛЬНО ДЛЯ КАЖДОГО ЯЗЫКА: ключ `<id>@<локаль>`. Иначе правка,
  // сделанная на русской версии, показывалась бы и на казахской (а казахский —
  // главный язык сайта), затирая перевод. Пока правки для текущего языка нет,
  // работает fallback — это уже переведённое через t() значение.
  const storageKey = `${field}@${locale}`;
  const value = ctx ? siteText(ctx.content, storageKey, fallback) : fallback;
  const hasStored =
    !!ctx && typeof ctx.content[storageKey] === "string" && (ctx.content[storageKey] as string).trim().length > 0;

  if (!ctx || !ctx.editMode) {
    return <span className={className} style={{ whiteSpace: "pre-line" }}>{value}</span>;
  }

  async function handleSave() {
    if (!ctx) return;
    setSaving(true);
    const ok = await ctx.save(storageKey, draft.trim() || value);
    setSaving(false);
    if (ok) {
      setOpen(false);
    }
  }

  async function handleReset() {
    if (!ctx) return;
    setSaving(true);
    const ok = await ctx.reset(storageKey);
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

export function EditableImageControl({ field, fallbackSrc, alt = "", className, sizesHint }: EditableImageProps) {
  const ctx = useContext(SiteEditContext);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; base: ImgTransform; w: number; h: number; moved: boolean } | null>(null);

  const src = ctx ? siteText(ctx.content, field, fallbackSrc) : fallbackSrc;
  const storedTransform = ctx ? parseTransform(ctx.content[transformKeyFor(field)]) : null;
  const hasStoredSrc =
    !!ctx && typeof ctx.content[field] === "string" && (ctx.content[field] as string).trim().length > 0;

  const [transform, setTransform] = useState<ImgTransform>(storedTransform ?? DEFAULT_TRANSFORM);
  const editing = !!ctx && ctx.editMode;

  // Ключ последнего сохранённого трансформа — чтобы debounce-эффект ниже не слал
  // лишних сохранений (в т.ч. на первом рендере и после router.refresh).
  const savedTransformKey = useRef<string>(
    storedTransform && !isIdentityTransform(storedTransform) ? JSON.stringify(storedTransform) : "",
  );
  /** Незавершённое сохранение трансформа (ждёт паузы дебаунса). */
  const pendingFlushRef = useRef<null | (() => Promise<void>)>(null);

  // Debounce-сохранение трансформа: через 1.2 с после последнего изменения. Серия
  // движений/прокруток/кликов по кнопкам складывается в ОДНО сохранение. Пауза длинная
  // намеренно: каждое сохранение сбрасывает кэш контента всего сайта (revalidateTag),
  // а это тот самый механизм, из-за которого раньше вылезал перерасход egress Supabase.
  // Трансформ по умолчанию не храним — просто убираем override-ключ.
  useEffect(() => {
    if (!editing || !ctx) return;
    const key = isIdentityTransform(transform) ? "" : JSON.stringify(transform);
    if (key === savedTransformKey.current) return;

    const commit = async () => {
      const target = transformKeyFor(field);
      // refresh: false — картинка в режиме редактирования рисуется из локального
      // состояния, перерисовывать серверную разметку на каждый штрих незачем.
      const ok = key === ""
        ? await ctx.reset(target, { refresh: false })
        : await ctx.save(target, key, { refresh: false });
      // Помечаем сохранённым ТОЛЬКО после успеха: иначе при упавшем запросе
      // (протухшая сессия, 500) повтор был бы навсегда заблокирован, а на экране
      // всё выглядело бы сохранённым.
      if (ok) savedTransformKey.current = key;
    };

    // Держим «несохранённое» под рукой, чтобы досохранить при уходе со страницы.
    pendingFlushRef.current = commit;
    const timer = setTimeout(() => {
      pendingFlushRef.current = null;
      void commit();
    }, 1200);
    // ВАЖНО: в cleanup только снимаем таймер. Сохранять здесь нельзя — cleanup
    // срабатывает на КАЖДОЕ изменение transform, и дебаунс перестал бы работать.
    return () => clearTimeout(timer);
  }, [transform, editing, ctx, field]);

  // Досохранение несохранённого: при размонтировании (уход по ссылке шапки/нижней
  // навигации) и при скрытии вкладки. Иначе последняя правка положения фото,
  // не дождавшаяся паузы дебаунса, молча пропадает.
  useEffect(() => {
    const flush = () => {
      const commit = pendingFlushRef.current;
      pendingFlushRef.current = null;
      if (commit) void commit();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, []);

  // Колесо мыши = масштаб. Слушатель вешаем вручную с { passive: false }, чтобы
  // preventDefault реально блокировал прокрутку страницы. setTransform стабилен, а
  // функциональный апдейт всегда берёт свежее значение — ref для этого не нужен.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !editing) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.06 : 0.94;
      setTransform((t) => ({ ...t, scale: clampNum(t.scale * factor, 0.2, 4) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editing]);

  // Перетаскивание = сдвиг. Базовый трансформ фиксируем в начале жеста (dragRef),
  // дальше считаем АБСОЛЮТНЫЙ сдвиг в % от рамки — без накопления ошибки.
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, base: transform, w: rect.width, h: rect.height, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3) d.moved = true;
    const dx = ((e.clientX - d.startX) / d.w) * 100;
    const dy = ((e.clientY - d.startY) / d.h) * 100;
    setTransform({ ...d.base, x: clampNum(d.base.x + dx, -150, 150), y: clampNum(d.base.y + dy, -150, 150) });
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (d && !d.moved) setOpen(true); // клик без перетаскивания → точная настройка
  }

  // Кнопки/ползунки: функциональный setState — всегда от свежего значения, без ref.
  const nudgeScale = (delta: number) => setTransform((t) => ({ ...t, scale: clampNum(t.scale + delta, 0.2, 4) }));
  const rotateBy = (deg: number) =>
    setTransform((t) => {
      let r = t.rotate + deg;
      if (r > 180) r -= 360;
      if (r < -180) r += 360;
      return { ...t, rotate: r };
    });
  const toggleFit = () => setTransform((t) => ({ ...t, fit: t.fit === "cover" ? "contain" : "cover" }));
  const patchTransform = (patch: Partial<ImgTransform>) => setTransform((t) => ({ ...t, ...patch }));
  const resetTransform = () => setTransform(DEFAULT_TRANSFORM);

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

  async function handleResetSrc() {
    if (!ctx) return;
    const ok = await ctx.reset(field);
    if (ok) setOpen(false);
  }

  // Публичный рендер / режим просмотра: обычная картинка + сохранённый трансформ,
  // если он есть (без него — style не задаём, чтобы не трогать нетронутые фото).
  if (!editing) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} style={storedTransform ? transformStyle(storedTransform) : undefined} />
    );
  }

  const toolbarBtn = (glyph: string, title: string, onClick: () => void) => (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="flex size-6 items-center justify-center rounded text-[13px] leading-none hover:bg-white/25"
    >
      {glyph}
    </button>
  );

  const slider = (label: string, value: number, min: number, max: number, onChange: (v: number) => void) => (
    <label className="flex items-center gap-2 text-[11px] font-semibold text-muted">
      <span className="w-[74px] shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} value={value}
        // Во время загрузки файла ползунки заблокированы: сохранение нового URL и
        // сохранение положения иначе состязались бы за один и тот же site_content.
        disabled={uploading}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="flex-1 accent-coral disabled:opacity-50"
      />
      <span className="w-9 text-right tabular-nums text-dark">{value}</span>
    </label>
  );

  const fitBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
        active ? "border-coral bg-coral text-white" : "border-black/15 bg-white text-dark hover:bg-black/5"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <span
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title={sizesHint ?? "Тяните — подвинуть · колесо — масштаб · клик — точная настройка"}
        style={{ touchAction: "none" }}
        className="relative block h-full w-full cursor-move select-none outline outline-2 outline-dashed outline-coral/70 transition hover:outline-coral"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} style={transformStyle(transform)} draggable={false} />

        {/* тулбар быстрых действий */}
        <span
          className="pointer-events-auto absolute left-1 top-1 z-20 flex flex-wrap items-center gap-0.5 rounded-md bg-black/70 p-0.5 text-white shadow-md"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {toolbarBtn("−", "Уменьшить", () => nudgeScale(-0.1))}
          {toolbarBtn("+", "Увеличить", () => nudgeScale(0.1))}
          {toolbarBtn("⟳", "Повернуть на 15°", () => rotateBy(15))}
          {toolbarBtn(
            transform.fit === "cover" ? "▣" : "▢",
            transform.fit === "cover" ? "Вписать целиком" : "Заполнить рамку (кадрировать)",
            toggleFit,
          )}
          {toolbarBtn("↺", "Сбросить положение", resetTransform)}
          {toolbarBtn("🖼", "Заменить фото · точная настройка", () => setOpen(true))}
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

                {/* превью с текущим трансформом */}
                <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-contain" style={transformStyle(transform)} />
                </div>

                {/* точная настройка положения */}
                <div className="mt-3 space-y-2">
                  {slider("Масштаб", Math.round(transform.scale * 100), 20, 400, (v) => patchTransform({ scale: v / 100 }))}
                  {/* Пределы те же, что у перетаскивания мышью (±150), иначе ползунок
                      «не догонял» бы уже сдвинутое фото и дёргал его назад. */}
                  {slider("Сдвиг ←→", Math.round(transform.x), -150, 150, (v) => patchTransform({ x: v }))}
                  {slider("Сдвиг ↑↓", Math.round(transform.y), -150, 150, (v) => patchTransform({ y: v }))}
                  {slider("Поворот", Math.round(transform.rotate), -180, 180, (v) => patchTransform({ rotate: v }))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted">Вписывание:</span>
                  {fitBtn("Целиком", transform.fit !== "cover", () => patchTransform({ fit: "contain" }))}
                  {fitBtn("Заполнить", transform.fit === "cover", () => patchTransform({ fit: "cover" }))}
                  <button
                    type="button"
                    onClick={resetTransform}
                    className="ml-auto rounded-md px-2.5 py-1 text-[11px] font-semibold text-muted underline-offset-2 hover:text-burgundy hover:underline"
                  >
                    Сбросить положение
                  </button>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFile}
                />
                {error ? <p className="mt-2 text-xs font-semibold text-burgundy">{error}</p> : null}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-black/10 pt-3">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-md border border-coral bg-coral px-4 py-1.5 text-xs font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
                  >
                    {uploading ? "Загружается…" : "Заменить фото"}
                  </button>
                  {hasStoredSrc ? (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleResetSrc}
                      className="rounded-md border border-black/15 bg-white px-4 py-1.5 text-xs font-semibold text-dark transition hover:bg-black/5 disabled:opacity-50"
                    >
                      Вернуть фото
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="ml-auto rounded-md px-3 py-1.5 text-xs font-semibold text-muted hover:text-dark"
                  >
                    Готово
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-muted">
                  Фото можно двигать прямо на странице (тянуть мышью), колесо — масштаб. JPG / PNG / WebP.
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
