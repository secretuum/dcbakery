"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { OrderItem, Product } from "@/src/types";

type RevisionLine = {
  productId: string;
  qty: string;
};

export function OrderRevisionForm({
  disabled,
  items,
  orderId,
  products,
}: {
  disabled?: boolean;
  items: OrderItem[];
  orderId: string;
  products: Product[];
}) {
  const router = useRouter();
  const [extraProductId, setExtraProductId] = useState("");
  const [extraQty, setExtraQty] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lines, setLines] = useState<RevisionLine[]>(
    items.map((item) => ({ productId: item.product_id, qty: String(item.qty) })),
  );
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  function updateLine(index: number, qty: string) {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) => (lineIndex === index ? { ...line, qty } : line)),
    );
  }

  async function handleSubmit() {
    if (disabled || isSubmitting) {
      return;
    }

    const nextItems = lines
      .map((line) => ({
        productId: line.productId,
        qty: Number(line.qty.replace(",", ".")),
      }))
      .filter((line) => Number.isFinite(line.qty) && line.qty > 0);

    if (extraProductId) {
      const qty = Number(extraQty.replace(",", "."));

      if (Number.isFinite(qty) && qty > 0) {
        nextItems.push({ productId: extraProductId, qty });
      }
    }

    setIsSubmitting(true);
    setStatus("idle");

    const response = await fetch(`/api/admin/orders/${orderId}/revision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: nextItems,
        note,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("success");
    router.refresh();
  }

  return (
    <section className="rounded-card border border-black/10 bg-white p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Предложить изменение</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Измените количество, добавьте позицию и отправьте клиенту на согласование.
      </p>

      <div className="mt-5 space-y-3">
        {lines.map((line, index) => {
          const product = productMap.get(line.productId);

          return (
            <div key={`${line.productId}-${index}`} className="grid gap-3 rounded-btn border border-black/5 bg-cream p-3 sm:grid-cols-[1fr_120px]">
              <div>
                <p className="text-sm font-semibold text-dark">
                  {product?.name ?? items[index]?.product_name ?? line.productId}
                </p>
                <p className="mt-1 font-data text-xs text-muted">{line.productId}</p>
              </div>
              <input
                value={line.qty}
                onChange={(event) => updateLine(index, event.currentTarget.value)}
                disabled={disabled || isSubmitting}
                className="min-h-10 rounded-btn border border-black/10 bg-white px-3 font-data text-sm font-semibold outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:opacity-60"
                inputMode="decimal"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 rounded-btn bg-coral-light p-3 sm:grid-cols-[1fr_110px]">
        <select
          value={extraProductId}
          onChange={(event) => setExtraProductId(event.currentTarget.value)}
          disabled={disabled || isSubmitting}
          className="min-h-10 rounded-btn border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:opacity-60"
        >
          <option value="">Добавить товар</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <input
          value={extraQty}
          onChange={(event) => setExtraQty(event.currentTarget.value)}
          disabled={disabled || isSubmitting}
          className="min-h-10 rounded-btn border border-black/10 bg-white px-3 font-data text-sm font-semibold outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:opacity-60"
          inputMode="decimal"
        />
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        placeholder="Комментарий клиенту: например, Наполеона сейчас 11 шт., предлагаем добавить Медовик"
        rows={3}
        disabled={disabled || isSubmitting}
        className="mt-4 w-full rounded-btn border border-black/10 bg-cream px-3 py-3 text-sm font-medium outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:opacity-60"
      />

      <button
        type="button"
        disabled={disabled || isSubmitting}
        onClick={handleSubmit}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-btn border border-coral bg-coral px-5 py-2 text-sm font-bold text-white transition hover:bg-coral-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Отправляю..." : "Отправить клиенту"}
      </button>
      {status === "success" ? (
        <p className="mt-2 text-xs font-semibold text-raspberry">Предложение отправлено</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-2 text-xs font-semibold text-burgundy">Не удалось отправить</p>
      ) : null}
    </section>
  );
}
