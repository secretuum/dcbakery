"use client";

import { useState } from "react";
import type { WhatsAppClientProfile } from "@/src/lib/whatsapp-client-store";

type ClientProfileFormProps = {
  client: WhatsAppClientProfile;
};

function joinAddresses(client: WhatsAppClientProfile) {
  const addresses = client.addresses?.length
    ? client.addresses.map((item) => item.address)
    : client.deliveryAddress
      ? [client.deliveryAddress]
      : [];

  return addresses.join("\n");
}

export function ClientProfileForm({ client }: ClientProfileFormProps) {
  const [status, setStatus] = useState<"idle" | "error" | "saving" | "success">("idle");

  async function handleSubmit(formData: FormData) {
    setStatus("saving");

    const response = await fetch(`/api/admin/clients/${encodeURIComponent(client.chatId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addressesText: String(formData.get("addressesText") ?? ""),
        companyName: String(formData.get("companyName") ?? ""),
        customerBin: String(formData.get("customerBin") ?? ""),
        customerEmail: String(formData.get("customerEmail") ?? ""),
        customerName: String(formData.get("customerName") ?? ""),
        customerPhone: String(formData.get("customerPhone") ?? ""),
        deliveryTime: String(formData.get("deliveryTime") ?? ""),
        paymentMethod: String(formData.get("paymentMethod") ?? ""),
      }),
    });

    setStatus(response.ok ? "success" : "error");
  }

  return (
    <form action={handleSubmit} className="rounded-card border border-black/10 bg-white p-5">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Данные клиента</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {[
          { label: "Компания", name: "companyName", value: client.companyName },
          { label: "БИН/ИП", name: "customerBin", value: client.customerBin },
          { label: "Контакт", name: "customerName", value: client.customerName },
          { label: "WhatsApp/телефон", name: "customerPhone", value: client.customerPhone },
          { label: "Email", name: "customerEmail", value: client.customerEmail },
          { label: "Время доставки", name: "deliveryTime", value: client.deliveryTime },
          { label: "Оплата", name: "paymentMethod", value: client.paymentMethod },
        ].map((field) => (
          <label key={field.name} className="block">
            <span className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{field.label}</span>
            <input
              name={field.name}
              defaultValue={field.value ?? ""}
              className="mt-2 min-h-11 w-full rounded-btn border border-black/10 bg-cream px-3 text-sm font-medium outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
          </label>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-[.08em] text-muted">
          Адреса, каждый с новой строки
        </span>
        <textarea
          name="addressesText"
          defaultValue={joinAddresses(client)}
          rows={5}
          className="mt-2 w-full rounded-btn border border-black/10 bg-cream px-3 py-3 text-sm font-medium outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex min-h-11 items-center justify-center rounded-btn border border-coral bg-coral px-5 py-2 text-sm font-bold text-white transition hover:bg-coral-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Сохраняю..." : "Сохранить"}
        </button>
        {status === "success" ? (
          <span className="text-sm font-semibold text-raspberry">Сохранено</span>
        ) : null}
        {status === "error" ? (
          <span className="text-sm font-semibold text-burgundy">Не удалось сохранить</span>
        ) : null}
      </div>
    </form>
  );
}
