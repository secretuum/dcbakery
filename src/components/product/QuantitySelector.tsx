"use client";

import { useT } from "@/src/i18n/client";

type QuantitySelectorProps = {
  className?: string;
  disabled?: boolean;
  maxQty?: number;
  minQty: number;
  onChange: (value: number) => void;
  stepQty: number;
  unit: string;
  value: number;
};

function normalizeQty(value: number, minQty: number, stepQty: number, maxQty?: number) {
  const safeMin = Math.max(minQty, 1);
  const safeStep = Math.max(stepQty, 1);
  const safeMax =
    typeof maxQty === "number" && Number.isFinite(maxQty)
      ? Math.max(0, Math.floor(maxQty))
      : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(value) || value <= safeMin) {
    return Math.min(safeMin, safeMax);
  }

  return Math.min(safeMin + Math.ceil((value - safeMin) / safeStep) * safeStep, safeMax);
}

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function QuantitySelector({
  className,
  disabled,
  maxQty,
  minQty,
  onChange,
  stepQty,
  unit,
  value,
}: QuantitySelectorProps) {
  const t = useT();
  const safeMin = Math.max(minQty, 1);
  const safeStep = Math.max(stepQty, 1);
  const safeMax =
    typeof maxQty === "number" && Number.isFinite(maxQty)
      ? Math.max(0, Math.floor(maxQty))
      : Number.POSITIVE_INFINITY;

  return (
    <div className={cx("flex items-center gap-1.5", className)}>
      <button
        type="button"
        disabled={disabled || value <= safeMin}
        onClick={() => onChange(normalizeQty(value - safeStep, safeMin, safeStep, safeMax))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-black/10 text-xl font-bold text-dark transition hover:bg-black/5 disabled:pointer-events-none disabled:opacity-40"
        aria-label={t("Уменьшить количество")}
      >
        −
      </button>
      <label className="flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-btn border border-black/10 bg-white px-2">
        <input
          type="number"
          min={safeMin}
          max={Number.isFinite(safeMax) ? safeMax : undefined}
          step={safeStep}
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onChange(
              normalizeQty(Number(event.currentTarget.value), safeMin, safeStep, safeMax),
            )
          }
          className="w-full bg-transparent text-center font-data text-base font-semibold text-dark outline-none"
          aria-label={t("Количество, ${unit}", { unit })}
        />
        <span className="ml-1 text-sm font-semibold text-muted">{unit}</span>
      </label>
      <button
        type="button"
        disabled={disabled || value >= safeMax}
        onClick={() =>
          onChange(normalizeQty(value + safeStep, safeMin, safeStep, safeMax))
        }
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-coral bg-coral text-xl font-bold text-white transition hover:bg-coral-hover disabled:pointer-events-none disabled:border-black/10 disabled:bg-black/5 disabled:text-muted"
        aria-label={t("Увеличить количество")}
      >
        +
      </button>
    </div>
  );
}
