"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/src/lib/format";

type ClientOpt = { chatId: string; label: string };
type ProductOpt = { id: string; name: string; price: number; unit: string };
type Line = { product_id: string; name: string; price: number; unit: string; qty: number };

const fieldClass =
  "mt-1 w-full rounded border border-black/15 bg-white px-3 py-2.5 text-sm text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";

const PAYMENT_METHODS = ["Выставить счет", "Безналичный расчет"];

export function NewOrderForm({ clients, products }: { clients: ClientOpt[]; products: ProductOpt[] }) {
  const router = useRouter();
  const [chatId, setChatId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [comment, setComment] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pickProduct, setPickProduct] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.qty, 0), [lines]);

  function addLine() {
    const product = products.find((p) => p.id === pickProduct);
    const qty = Number(pickQty);
    if (!product || !Number.isFinite(qty) || qty <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.product_id === product.id);
      if (existing) {
        return prev.map((l) => (l.product_id === product.id ? { ...l, qty: l.qty + qty } : l));
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, unit: product.unit, qty }];
    });
    setPickQty("1");
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.product_id !== id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!chatId) {
      setError("Выберите клиента");
      return;
    }
    if (lines.length === 0) {
      setError("Добавьте хотя бы одну позицию");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          deliveryDate,
          paymentMethod,
          comment,
          items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { errors?: string[]; error?: string };
      if (!res.ok) {
        setError(
          Array.isArray(data.errors) ? data.errors.join(". ") : data.error ?? "Не удалось создать заявку",
        );
        setSaving(false);
        return;
      }
      router.push("/admin/orders");
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/orders" className="text-sm font-semibold text-coral hover:text-coral-hover">
        ← Заказы
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Заявка от клиента</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Заявка встанет в статус «ожидает подтверждения» — принимает её админ.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-card border border-black/10 bg-white p-5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Клиент <span className="text-coral">*</span></span>
          <select value={chatId} onChange={(e) => setChatId(e.currentTarget.value)} className={fieldClass}>
            <option value="">— выберите клиента —</option>
            {clients.map((c) => (
              <option key={c.chatId} value={c.chatId}>{c.label}</option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Дата доставки <span className="text-coral">*</span></span>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.currentTarget.value)} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Оплата</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.currentTarget.value)} className={fieldClass}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>

        {/* Позиции */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Позиции <span className="text-coral">*</span></span>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <select value={pickProduct} onChange={(e) => setPickProduct(e.currentTarget.value)} className={`${fieldClass} min-w-[220px] flex-1`}>
              <option value="">— товар —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {formatPrice(p.price)}/{p.unit}</option>
              ))}
            </select>
            <input
              type="number" min="1" value={pickQty} onChange={(e) => setPickQty(e.currentTarget.value)}
              className={`${fieldClass} w-24`} aria-label="Количество"
            />
            <button type="button" onClick={addLine} className="rounded border border-coral bg-coral px-4 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover">
              Добавить
            </button>
          </div>

          {lines.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded border border-black/10">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-black/10">
                  {lines.map((l) => (
                    <tr key={l.product_id}>
                      <td className="px-3 py-2 font-semibold text-dark">{l.name}</td>
                      <td className="px-3 py-2 text-muted">{l.qty} {l.unit}</td>
                      <td className="px-3 py-2 text-right font-data font-semibold">{formatPrice(l.price * l.qty)}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => removeLine(l.product_id)} className="text-xs font-semibold text-muted hover:text-burgundy">убрать</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-cream">
                    <td className="px-3 py-2 font-bold" colSpan={2}>Итого (без доставки)</td>
                    <td className="px-3 py-2 text-right font-data font-bold">{formatPrice(total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Позиции не добавлены.</p>
          )}
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Комментарий</span>
          <textarea value={comment} onChange={(e) => setComment(e.currentTarget.value)} className={`${fieldClass} min-h-20`} placeholder="Необязательно" />
        </label>

        {error ? <p className="text-sm font-semibold text-burgundy">{error}</p> : null}

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving} className="rounded border border-coral bg-coral px-5 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-50">
            {saving ? "Создаю…" : "Создать заявку"}
          </button>
          <Link href="/admin/orders" className="text-sm font-semibold text-muted hover:text-dark">Отмена</Link>
        </div>
      </form>
    </div>
  );
}
