"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Ручное создание клиента сотрудником (admin/manager) без OTP — стадия 2 фичи
// торгпредов. POST /api/admin/clients (доступ пускает proxy).

const fieldClass =
  "mt-1 w-full rounded border border-black/15 bg-white px-3 py-2.5 text-sm text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";

function Field({
  label,
  name,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
        {required ? <span className="text-coral"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        required={required}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  );
}

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    phone: "",
    customerBin: "",
    customerName: "",
    deliveryAddress: "",
    accountantPhone: "",
    email: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { chatId?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать клиента");
        setSaving(false);
        return;
      }
      router.push(data.chatId ? `/admin/clients/${encodeURIComponent(data.chatId)}` : "/admin/clients");
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <Link href="/admin/clients" className="text-sm font-semibold text-coral hover:text-coral-hover">
        ← Клиенты
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Новый клиент</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Заводит профиль вручную, без подтверждения по коду. Кредитная строка создаётся предоплатной
        (лимит 0) — измените в карточке клиента при необходимости.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-card border border-black/10 bg-white p-5">
        <Field label="Компания / заведение" name="companyName" value={form.companyName} onChange={set("companyName")} required placeholder="Например, Coffee Point" />
        <Field label="Телефон (WhatsApp)" name="phone" value={form.phone} onChange={set("phone")} required placeholder="+7 705 123 45 67" type="tel" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="БИН / ИИН" name="customerBin" value={form.customerBin} onChange={set("customerBin")} placeholder="12 цифр (необязательно)" />
          <Field label="Контактное лицо" name="customerName" value={form.customerName} onChange={set("customerName")} placeholder="Имя (необязательно)" />
        </div>
        <Field label="Адрес доставки" name="deliveryAddress" value={form.deliveryAddress} onChange={set("deliveryAddress")} placeholder="Город, улица, дом (необязательно)" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон бухгалтерии" name="accountantPhone" value={form.accountantPhone} onChange={set("accountantPhone")} placeholder="Необязательно" type="tel" />
          <Field label="Email" name="email" value={form.email} onChange={set("email")} placeholder="Необязательно" type="email" />
        </div>

        {error ? <p className="text-sm font-semibold text-burgundy">{error}</p> : null}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded border border-coral bg-coral px-5 py-2.5 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : "Создать клиента"}
          </button>
          <Link href="/admin/clients" className="text-sm font-semibold text-muted hover:text-dark">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
