"use client";
// Кадрирование фото без внешних зависимостей: квадратная рамка, изображение под ней
// можно двигать (drag) и зумить (слайдер). «Применить» рисует видимую область на canvas
// и отдаёт БЕЗ СЖАТИЯ (PNG, lossless) в полном разрешении кропа. Потолок 4096px — только
// защита от падения браузера на очень больших исходниках (для реальных фото не срабатывает).

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  file: File;
  outputSize?: number; // потолок стороны результата, px (защита от лимитов canvas)
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
};

export function ImageCropper({ file, outputSize = 4096, onCancel, onCropped }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  // Размер квадратной рамки держим в state (не читаем ref в рендере) — замеряем на
  // монтировании и ресайзе.
  const [frameW, setFrameW] = useState(320);
  const src = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  useEffect(() => {
    const measure = () => setFrameW(frameRef.current?.clientWidth ?? 320);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const cover = () => (nat ? Math.max(frameW / nat.w, frameW / nat.h) : 1);
  const disp = () => {
    const b = cover() * scale;
    return nat ? { w: nat.w * b, h: nat.h * b } : { w: 0, h: 0 };
  };

  function clampOffset(x: number, y: number, forScale = scale) {
    if (!nat) return { x, y };
    const b = cover() * forScale;
    const w = nat.w * b;
    const h = nat.h * b;
    return { x: Math.min(0, Math.max(frameW - w, x)), y: Math.min(0, Math.max(frameW - h, y)) };
  }

  function handleLoad() {
    const img = imgElRef.current;
    if (!img) return;
    const n = { w: img.naturalWidth, h: img.naturalHeight };
    const f = frameRef.current?.clientWidth ?? frameW;
    setFrameW(f);
    setNat(n);
    const b = Math.max(f / n.w, f / n.h); // cover, scale 1
    setScale(1);
    setOffset({ x: (f - n.w * b) / 2, y: (f - n.h * b) / 2 });
  }

  // Зум вокруг центра рамки + клэмп.
  function setZoom(next: number) {
    const s = Math.min(4, Math.max(1, next));
    const c = frameW / 2;
    setOffset((prev) =>
      clampOffset(c - (c - prev.x) * (s / scale), c - (c - prev.y) * (s / scale), s),
    );
    setScale(s);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clampOffset(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py)));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  async function apply() {
    const img = imgElRef.current;
    if (!img || !nat) return;
    setBusy(true);
    try {
      const b = cover() * scale;
      const sx = -offset.x / b;
      const sy = -offset.y / b;
      const sSize = frameW / b;
      const target = Math.max(1, Math.min(outputSize, Math.round(sSize)));
      const canvas = document.createElement("canvas");
      canvas.width = target;
      canvas.height = target;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setBusy(false);
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, target, target);
      // PNG — без потери качества (lossless).
      canvas.toBlob((blob) => {
        setBusy(false);
        if (blob) onCropped(blob);
      }, "image/png");
    } catch {
      setBusy(false);
    }
  }

  const d = disp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-4 shadow-xl">
        <p className="mb-1 text-sm font-semibold text-dark">Кадрировать фото</p>
        <p className="mb-3 text-xs text-muted">Двигайте изображение и меняйте зум — что в рамке, то и сохранится.</p>
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mx-auto aspect-square w-full max-w-[360px] cursor-grab touch-none select-none overflow-hidden rounded-md border border-black/10 bg-cream active:cursor-grabbing"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- локальный object URL, кадратор, next/image неприменим
            <img
              ref={imgElRef}
              src={src}
              alt=""
              onLoad={handleLoad}
              draggable={false}
              style={{ position: "absolute", left: d.w ? offset.x : 0, top: d.w ? offset.y : 0, width: d.w || "auto", height: d.h || "auto", maxWidth: "none" }}
            />
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-muted">Зум</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={scale}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-coral"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-btn border border-black/15 px-4 py-2 text-sm font-semibold text-muted transition hover:bg-black/5"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={busy || !nat}
            onClick={() => void apply()}
            className="rounded-btn border border-coral bg-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral-hover disabled:opacity-50"
          >
            {busy ? "…" : "Применить"}
          </button>
        </div>
      </div>
    </div>
  );
}
