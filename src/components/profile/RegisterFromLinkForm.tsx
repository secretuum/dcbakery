"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Регистрация по одноразовой ссылке из WhatsApp. Номер уже подтверждён (только показ).
// Шаги: форма → код из WhatsApp (OTP) → кабинет. Токен гасим после успешной
// регистрации (single-use), чтобы неудачную попытку можно было повторить.

type RegisterResponse = { ok?: boolean; error?: string; needsOtp?: boolean };

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) {
    return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  }
  return `+${d}`;
}

const inputClass =
  "mt-1 w-full rounded-md border border-black/15 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-coral";
const labelClass = "block text-sm font-semibold text-dark";

export function RegisterFromLinkForm({ rt, phone }: { rt: string; phone: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp" | "email">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerBin, setCustomerBin] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/profile/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, password, companyName, customerName, customerBin }),
      });
      const body = (await res.json().catch(() => ({}))) as RegisterResponse;
      if (!res.ok) {
        setError(body.error ?? "Не удалось зарегистрироваться");
        return;
      }
      // Регистрация принята — гасим одноразовый токен (best-effort).
      void fetch("/api/register-link/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rt }),
      }).catch(() => undefined);

      setStep(body.needsOtp ? "otp" : "email");
    } catch {
      setError("Сеть недоступна, попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/profile/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json().catch(() => ({}))) as RegisterResponse;
      if (!res.ok) {
        setError(body.error ?? "Неверный код");
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setError("Сеть недоступна, попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }

  if (step === "email") {
    return (
      <p className="rounded-md bg-coral-light px-4 py-3 text-sm font-semibold text-burgundy">
        Мы отправили ссылку подтверждения на почту. Перейдите по ней, чтобы войти в кабинет.
      </p>
    );
  }

  if (step === "otp") {
    return (
      <form onSubmit={submitOtp} className="space-y-4">
        <p className="text-sm leading-6 text-muted">
          Мы отправили код в WhatsApp на {formatPhone(phone)}. Введите его:
        </p>
        <div>
          <label className={labelClass} htmlFor="otp">
            Код из WhatsApp
          </label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${inputClass} font-data tracking-[.3em]`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        </div>
        {error ? <p className="text-sm font-semibold text-raspberry">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || code.length < 4}
          className="w-full rounded-btn bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-60"
        >
          {loading ? "Проверяем…" : "Подтвердить"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div>
        <label className={labelClass}>Телефон (подтверждён)</label>
        <input className={`${inputClass} bg-black/5 text-muted`} value={formatPhone(phone)} readOnly />
      </div>
      <div>
        <label className={labelClass} htmlFor="company">
          Компания
        </label>
        <input
          id="company"
          className={inputClass}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="bin">
          БИН/ИИН (необязательно)
        </label>
        <input
          id="bin"
          inputMode="numeric"
          className={inputClass}
          value={customerBin}
          onChange={(e) => setCustomerBin(e.target.value.replace(/\D/g, "").slice(0, 12))}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="name">
          Контактное лицо (необязательно)
        </label>
        <input
          id="name"
          className={inputClass}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm font-semibold text-raspberry">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-btn bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-60"
      >
        {loading ? "Отправляем…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
