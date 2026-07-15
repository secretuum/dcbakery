"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import type { Client } from "@/src/types";

type Props = {
  client: Client | null;
  defaultPhone: string;
  defaultName: string;
};

const statusOptions = [
  { value: "active", label: "Активен (кредит открыт)" },
  { value: "prepay_only", label: "Только предоплата" },
  { value: "blocked", label: "Блокирован" },
] as const;

const priceListOptions = [
  { value: "", label: "Не назначен" },
  { value: "opt-1", label: "Опт-1" },
  { value: "opt-2", label: "Опт-2" },
];

export function ClientCreditForm({ client, defaultPhone, defaultName }: Props) {
  const [creditLimit, setCreditLimit] = useState(String(client?.credit_limit ?? 0));
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    String(client?.payment_terms_days ?? 7),
  );
  const [graceDays, setGraceDays] = useState(String(client?.grace_days ?? 3));
  const [priceListId, setPriceListId] = useState(client?.price_list_id ?? "");
  const [iikoCounterAgentId, setIikoCounterAgentId] = useState(
    client?.iiko_counteragent_id ?? "",
  );
  const [status, setStatus] = useState<Client["status"]>(client?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/clients/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client?.id,
          name: defaultName || defaultPhone,
          phone: defaultPhone || null,
          credit_limit: Number(creditLimit) || 0,
          payment_terms_days: Number(paymentTermsDays) || 7,
          grace_days: Number(graceDays) || 3,
          price_list_id: priceListId || null,
          iiko_counteragent_id: iikoCounterAgentId || null,
          status,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось сохранить");
        return;
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-card border border-black/10 bg-white">
      <div className="border-b border-black/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Договорные условия</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Товарный кредит</h2>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <label className="block">
          <span className="text-sm font-semibold text-dark">Кредитный лимит (₸)</span>
          <Input
            className="mt-2"
            inputMode="numeric"
            type="number"
            min="0"
            step="1000"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.currentTarget.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-dark">Отсрочка (дней)</span>
          <Input
            className="mt-2"
            inputMode="numeric"
            type="number"
            min="0"
            max="90"
            value={paymentTermsDays}
            onChange={(e) => setPaymentTermsDays(e.currentTarget.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-dark">Льготный период (дней)</span>
          <Input
            className="mt-2"
            inputMode="numeric"
            type="number"
            min="0"
            max="30"
            value={graceDays}
            onChange={(e) => setGraceDays(e.currentTarget.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-dark">Прайс-лист</span>
          <select
            className="mt-2 w-full rounded-btn border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-dark focus:outline-none focus:ring-2 focus:ring-coral/40"
            value={priceListId}
            onChange={(e) => setPriceListId(e.currentTarget.value)}
          >
            {priceListOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-dark">ID контрагента в iiko</span>
          <Input
            className="mt-2"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={iikoCounterAgentId}
            onChange={(e) => setIikoCounterAgentId(e.currentTarget.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-dark">Статус отгрузок</span>
          <select
            className="mt-2 w-full rounded-btn border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-dark focus:outline-none focus:ring-2 focus:ring-coral/40"
            value={status}
            onChange={(e) => setStatus(e.currentTarget.value as Client["status"])}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Статус «Активен» автоматически меняется на «Предоплата» или «Блокирован» при просрочке.
            Ручная установка переопределяет автоматику.
          </p>
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-black/10 px-5 py-4 sm:px-6">
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </Button>
        {saved ? <span className="text-sm font-semibold text-raspberry">Сохранено</span> : null}
        {error ? <span className="text-sm font-semibold text-burgundy">{error}</span> : null}
      </div>
    </section>
  );
}
