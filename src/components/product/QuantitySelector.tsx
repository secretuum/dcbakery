"use client";

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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-black text-coral transition hover:bg-coral/10 active:bg-coral/20 disabled:pointer-events-none disabled:opacity-40"
        aria-label="Уменьшить количество"
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
          className="w-full bg-transparent text-center text-base font-black text-dark outline-none"
          aria-label={`Количество, ${unit}`}
        />
        <span className="ml-1 text-sm font-bold text-muted">{unit}</span>
      </label>
      <button
        type="button"
        disabled={disabled || value >= safeMax}
        onClick={() =>
          onChange(normalizeQty(value + safeStep, safeMin, safeStep, safeMax))
        }
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coral text-xl font-black text-white transition hover:bg-coral-hover disabled:pointer-events-none disabled:bg-gray-300"
        aria-label="Увеличить количество"
      >
        +
      </button>
    </div>
  );
}
