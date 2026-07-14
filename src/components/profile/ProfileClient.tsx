"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { clientOrderStatusLabels, creditStatusLabels, orderStatusLabels, paymentStatusLabels } from "@/src/lib/order-status";
import { useCart } from "@/src/contexts/CartContext";
import type { ClientOrderSummary, CreditState, OrderItemSummary, Product } from "@/src/types";

type AdminSession = {
  email: string;
  role: "admin";
};

type ClientSession = {
  companyName: string;
  createdAt: string;
  email: string;
  phone: string;
  accountant_phone?: string;
  role: "client";
};

type ProfileSession = AdminSession | ClientSession;

type ProfileSessionResponse = {
  authenticated?: boolean;
  email?: string;
  role?: "admin" | null;
};

type ClientSessionResponse = {
  authenticated: boolean;
  email?: string;
  phone?: string;
  companyName?: string;
  accountantPhone?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-KZ", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "KZT",
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function AdminIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}

function ClientIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4 6 4v14" />
      <path d="M9 21v-7h6v7" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-black/10 bg-white p-5">
      {icon && <div className="shrink-0">{icon}</div>}
      <div>
        <p className="text-2xl font-bold tracking-tight text-dark">{value}</p>
        <p className="mt-0.5 text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function LoginPanel({ onLogin }: { onLogin: (session: ProfileSession) => void }) {
  // Admin section state
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  // Client magic link section state
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientError, setClientError] = useState("");
  const [clientStep, setClientStep] = useState<"idle" | "sending" | "sent" | "needs_registration" | "registering">("idle");

  async function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminError("");

    const normalizedEmail = adminEmail.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setAdminError("Введите email и пароль");
      return;
    }

    setIsAdminSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (response.ok) {
        onLogin({ email: normalizedEmail, role: "admin" });
        return;
      }

      if (response.status !== 401) {
        setAdminError("Не удалось войти. Попробуйте еще раз");
        return;
      }

      setAdminError(
        "Неверный email или пароль. Проверьте пользователя в Supabase Authentication.",
      );
    } catch {
      setAdminError("Не удалось войти. Проверьте соединение и попробуйте снова");
    } finally {
      setIsAdminSubmitting(false);
    }
  }

  async function handleClientMagicLink() {
    const normalizedEmail = clientEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setClientError("Введите email");
      return;
    }

    setClientError("");
    setClientStep("sending");

    try {
      const response = await fetch("/api/profile/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        needsRegistration?: boolean;
      };

      if (response.ok && data.needsRegistration) {
        // New client — show registration form
        setClientStep("needs_registration");
        return;
      }

      if (!response.ok) {
        setClientError(data.error ?? "Не удалось отправить ссылку");
        setClientStep("idle");
        return;
      }

      setClientStep("sent");
    } catch {
      setClientError("Не удалось отправить ссылку. Проверьте соединение");
      setClientStep("idle");
    }
  }

  async function handleRegistration() {
    const normalizedEmail = clientEmail.trim().toLowerCase();
    const phoneDigits = clientPhone.replace(/\D/g, "");

    if (phoneDigits.length < 11) {
      setClientError("Введите корректный номер телефона WhatsApp");
      return;
    }

    setClientError("");
    setClientStep("registering");

    try {
      const response = await fetch("/api/profile/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          phone: clientPhone,
          companyName: clientCompany,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setClientError(data.error ?? "Не удалось создать аккаунт");
        setClientStep("needs_registration");
        return;
      }

      setClientStep("sent");
    } catch {
      setClientError("Не удалось отправить ссылку. Проверьте соединение");
      setClientStep("needs_registration");
    }
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
      <div>
        <p className="text-sm font-black uppercase text-raspberry">Профиль</p>
        <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          Вход в кабинет DC Bakery
        </h1>
        <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-muted">
          Клиенты входят по ссылке в WhatsApp. Менеджеры — через Supabase Authentication.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-card bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-raspberry">
              <ClientIcon />
              <p className="text-sm font-black">Клиент</p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">
              История заказов, повтор закупки, настройки компании и документы.
            </p>
          </div>
          <div className="rounded-card bg-coral-light p-5 shadow-sm">
            <div className="flex items-center gap-3 text-burgundy">
              <AdminIcon />
              <p className="text-sm font-black">Админ</p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-burgundy/75">
              Заказы, товары, оплаты, остатки и настройки маркетплейса.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Client magic link */}
        <div className="rounded-card bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase text-raspberry">Клиентский кабинет</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">Войти по WhatsApp</h2>

          {clientStep === "sent" ? (
            <div className="mt-5 rounded-xl bg-green-50 p-4">
              <p className="text-sm font-black text-green-700">Ссылка отправлена в WhatsApp</p>
              <p className="mt-1 text-sm font-semibold text-green-600/80">
                Откройте WhatsApp и перейдите по ссылке. Она действует 15 минут.
              </p>
            </div>
          ) : clientStep === "needs_registration" || clientStep === "registering" ? (
            <>
              <div className="mt-4 rounded-xl border border-coral/20 bg-coral-light px-4 py-3">
                <p className="text-xs font-black uppercase text-burgundy">Новый партнёр</p>
                <p className="mt-1 text-sm font-semibold text-dark/80">
                  Аккаунт для <span className="font-black">{clientEmail}</span> не найден.
                  Укажите номер WhatsApp для регистрации — ссылка для входа придёт туда.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-black text-dark">Телефон WhatsApp</span>
                  <Input
                    className="mt-2"
                    inputMode="tel"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleRegistration();
                      }
                    }}
                    placeholder="+7 (705) 000-00-00"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-dark">Компания / заведение</span>
                  <Input
                    className="mt-2"
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.currentTarget.value)}
                    placeholder="Название компании"
                  />
                </label>
              </div>
              {clientError ? (
                <p className="mt-3 text-sm font-bold text-burgundy">{clientError}</p>
              ) : null}
              <div className="mt-5 flex gap-3">
                <Button
                  type="button"
                  disabled={clientStep === "registering"}
                  className="flex-1"
                  onClick={() => void handleRegistration()}
                >
                  {clientStep === "registering" ? "Создаём аккаунт..." : "Создать и войти"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setClientStep("idle");
                    setClientError("");
                  }}
                >
                  Назад
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-5">
                <label className="block">
                  <span className="text-sm font-black text-dark">Email</span>
                  <Input
                    className="mt-2"
                    inputMode="email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleClientMagicLink();
                      }
                    }}
                    placeholder="company@example.com"
                  />
                </label>
              </div>
              {clientError ? (
                <p className="mt-3 text-sm font-bold text-burgundy">{clientError}</p>
              ) : null}
              <Button
                type="button"
                disabled={clientStep === "sending"}
                className="mt-5 w-full"
                onClick={() => void handleClientMagicLink()}
              >
                {clientStep === "sending" ? "Проверяем..." : "Войти по WhatsApp"}
              </Button>
            </>
          )}
        </div>

        {/* Admin form */}
        <form onSubmit={(e) => void handleAdminSubmit(e)} className="rounded-card bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase text-muted">Для менеджеров</p>
          <h2 className="mt-2 text-4xl font-black tracking-tight">Email и пароль</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm font-black text-dark">Email</span>
              <Input
                className="mt-1.5"
                inputMode="email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.currentTarget.value)}
                placeholder="admin@example.com"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-dark">Пароль</span>
              <Input
                className="mt-1.5"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                placeholder="••••••••"
              />
            </label>
          </div>
          {adminError ? (
            <p className="mt-3 text-sm font-bold text-burgundy">{adminError}</p>
          ) : null}
          <Button type="submit" disabled={isAdminSubmitting} variant="outline" className="mt-5 w-full">
            {isAdminSubmitting ? "Проверяем..." : "Войти как менеджер"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function AdminDashboard({
  session,
  onLogout,
}: {
  session: AdminSession;
  onLogout: () => void;
}) {
  const [previewMode, setPreviewMode] = useState(false);

  if (previewMode) {
    return (
      <div>
        <div className="print-hidden mb-4 flex items-center justify-between rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-black text-amber-700">Режим превью — вид клиента</p>
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setPreviewMode(false)}
          >
            Выйти из превью
          </Button>
        </div>
        <ClientDashboard
          session={{ role: "client", email: session.email, phone: "", companyName: "Превью", createdAt: "" }}
          onLogout={() => setPreviewMode(false)}
          onUpdate={() => undefined}
        />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 rounded-card bg-dark p-6 text-white shadow-sm lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div>
          <p className="text-sm font-black uppercase text-coral">Админ-профиль</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">DC Bakery Manager</h1>
          <p className="mt-3 break-all text-sm font-semibold text-white/70">{session.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/admin/orders" className="bg-white text-dark hover:bg-coral-light">
            Заказы
          </Button>
          <Button href="/admin/products" variant="outline" className="border-white text-white hover:bg-white/10">
            Товары
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => setPreviewMode(true)}
          >
            Вид клиента
          </Button>
          <Button type="button" variant="ghost" className="text-white hover:bg-white/10" onClick={onLogout}>
            Выйти
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Заявки" value="Заказы" icon={
          <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        } />
        <MetricCard label="Оплата" value="Контроль" icon={
          <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        } />
        <MetricCard label="Каталог" value="Товары" icon={
          <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        } />
        <MetricCard label="Каналы" value="WA/TG" icon={
          <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        } />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Link
          href="/admin/orders"
          className="rounded-card bg-white p-6 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-black uppercase text-raspberry">Операции</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">Заказы</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            Новые заявки, подтверждение, ссылка оплаты и статусы доставки.
          </p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-card bg-white p-6 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-black uppercase text-raspberry">Каталог</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">Товары</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            Наличие, цены, активность товаров и подготовка к единой базе остатков.
          </p>
        </Link>
        <Link
          href="/admin/settings"
          className="rounded-card bg-white p-6 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-black uppercase text-raspberry">Система</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">Настройки</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            Параметры сайта, платежей и будущих интеграций.
          </p>
        </Link>
      </div>
    </section>
  );
}

function CreditBlock({ state }: { state: CreditState }) {
  const inTimePct =
    state.limit > 0
      ? Math.min(100, ((state.used - state.overdue) / state.limit) * 100)
      : 0;
  const overduePct =
    state.limit > 0
      ? Math.min(100 - inTimePct, (state.overdue / state.limit) * 100)
      : 0;

  return (
    <div className="overflow-hidden rounded border border-black/10 bg-white">
      <div className="grid divide-y divide-black/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {/* Cell 1 — лимит + бар */}
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">
            Товарный кредит
          </p>
          <p className="mt-2 font-data text-2xl font-semibold leading-none">
            {formatCurrency(state.used)}
            <span className="ml-1.5 text-sm font-normal text-muted">
              / {formatCurrency(state.limit)}
            </span>
          </p>
          {state.limit > 0 ? (
            <>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full bg-dark" style={{ width: `${inTimePct}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${overduePct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-dark" />
                  В срок {formatCurrency(state.used - state.overdue)}
                </span>
                {state.overdue > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-1.5 rounded-full bg-red-500" />
                    Просрочено {formatCurrency(state.overdue)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-black/15" />
                  Доступно {formatCurrency(state.available)}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Cell 2 — доступно */}
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">
            Доступно сейчас
          </p>
          <p className="mt-2 font-data text-2xl font-semibold leading-none text-green-700">
            {formatCurrency(state.available)}
          </p>
          <p className="mt-2 text-[11px] text-muted">{creditStatusLabels[state.status]}</p>
        </div>

        {/* Cell 3 — платёж */}
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">
            Ближайший платёж
          </p>
          <p
            className={`mt-2 font-data text-2xl font-semibold leading-none ${
              state.overdueDays > 0 ? "text-red-600" : ""
            }`}
          >
            {state.nextDueDate ? formatDate(state.nextDueDate) : "—"}
          </p>
          {state.overdueDays > 0 ? (
            <p className="mt-2 text-[11px] font-semibold text-red-600">
              Просрочка {state.overdueDays} дн · {formatCurrency(state.overdue)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Алерт просрочки */}
      {state.overdueDays > 0 ? (
        <div className="flex items-start gap-3 border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
          <svg className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" />
          </svg>
          <span>
            <b className="font-semibold">Просрочка {state.overdueDays} дн.</b>{" "}
            Отгрузки приостановлены до погашения {formatCurrency(state.overdue)}.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function OrderItemsList({ items }: { items: OrderItemSummary[] }) {
  return (
    <div className="mt-3 border-t border-black/10 pt-3">
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-dark">
              {item.product_name}{" "}
              <span className="font-normal text-muted">
                × {item.qty} {item.unit}
              </span>
            </span>
            <span className="shrink-0 font-black text-dark">{formatCurrency(item.total_amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ORDER_CHIP: Partial<Record<string, string>> = {
  pending_manager_confirmation: "bg-amber-50 text-amber-700",
  change_proposed: "bg-amber-50 text-amber-700",
  confirmed_waiting_payment: "bg-coral-light text-burgundy",
  delivering: "bg-blue-50 text-blue-700",
  paid: "bg-green-50 text-green-700",
  completed: "bg-green-50 text-green-700",
  canceled: "bg-black/5 text-muted",
  cancelled: "bg-black/5 text-muted",
};

function ClientOrderCard({ order }: { order: ClientOrderSummary }) {
  const orderStatus =
    clientOrderStatusLabels[order.status] ?? orderStatusLabels[order.status] ?? order.status;
  const chipClass = ORDER_CHIP[order.status] ?? "bg-black/5 text-muted";
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    order.due_date && order.due_date < today && order.payment_status !== "paid";
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - Date.parse(order.due_date!)) / 86_400_000)
    : 0;
  const [actionStatus, setActionStatus] = useState<"error" | "idle" | "loading">("idle");
  const [isExpanded, setIsExpanded] = useState(false);
  const canCancel =
    order.payment_status !== "paid" &&
    !["paid", "completed", "canceled", "cancelled"].includes(order.status);
  const canAcceptRevision = order.status === "change_proposed";
  const showDocs = !["pending_manager_confirmation", "change_proposed", "canceled", "cancelled"].includes(order.status);

  async function sendClientAction(
    action: "accept_revision" | "cancel" | "request_change",
    comment?: string,
  ) {
    setActionStatus("loading");
    const response = await fetch(`/api/orders/${order.id}/client-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
    if (!response.ok) { setActionStatus("error"); return; }
    window.location.reload();
  }

  return (
    <article className="rounded border border-black/10 bg-white hover:border-black/20 transition-colors">
      {/* Header row */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <span className="font-data font-semibold text-sm">{order.order_number}</span>
        <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.05em] ${chipClass}`}>
          {orderStatus}
        </span>
        <span className="ml-auto font-data font-semibold">{formatCurrency(order.total_amount)}</span>
        <span className="text-[10px] text-muted">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-black/5 px-4 py-2.5 text-xs text-muted">
        {order.delivery_date ? (
          <span>Отгрузка <b className="font-data font-medium text-dark">{formatDate(order.delivery_date)}</b></span>
        ) : null}
        {order.order_items?.length ? (
          <span>Позиций <b className="font-data font-medium text-dark">{order.order_items.length}</b></span>
        ) : null}
        {order.due_date ? (
          <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
            Оплата до <b className="font-data font-medium">{formatDate(order.due_date)}</b>
            {isOverdue ? ` · просрочка ${overdueDays} дн.` : ""}
          </span>
        ) : null}
      </div>

      {/* Expanded items */}
      {isExpanded && order.order_items && order.order_items.length > 0 ? (
        <div className="border-t border-black/5 px-4 py-3">
          <OrderItemsList items={order.order_items} />
        </div>
      ) : null}

      {/* Revision note */}
      {order.revision_note ? (
        <p className="border-t border-black/5 bg-coral-light px-4 py-2 text-sm font-semibold text-burgundy">
          {order.revision_note}
        </p>
      ) : null}

      {/* Actions footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-black/10 px-4 py-3">
        {canAcceptRevision ? (
          <button
            type="button"
            disabled={actionStatus === "loading"}
            className="rounded border border-dark bg-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-dark/80 disabled:opacity-50"
            onClick={() => void sendClientAction("accept_revision")}
          >
            Принять изменения
          </button>
        ) : null}
        {canAcceptRevision ? (
          <button
            type="button"
            disabled={actionStatus === "loading"}
            className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5 disabled:opacity-50"
            onClick={() => {
              const comment = window.prompt("Что нужно изменить в заявке?");
              if (comment?.trim()) void sendClientAction("request_change", comment);
            }}
          >
            Изменить
          </button>
        ) : null}
        {order.payment_url ? (
          <a
            href={order.payment_url}
            className="rounded border border-dark bg-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-dark/80"
          >
            Оплатить {formatCurrency(order.total_amount)}
          </a>
        ) : null}
        {showDocs ? (
          <>
            <Link href={`/documents/invoice/${order.id}`} className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5">
              Счет PDF
            </Link>
            <Link href={`/documents/nakl/${order.id}`} className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5">
              Накладная PDF
            </Link>
            {order.status === "completed" ? (
              <Link href={`/documents/avr/${order.id}`} className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5">
                АВР
              </Link>
            ) : null}
          </>
        ) : null}
        <Link href="/catalog" className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5">
          Повторить
        </Link>
        {canCancel ? (
          <button
            type="button"
            disabled={actionStatus === "loading"}
            className="rounded px-3 py-1.5 text-xs font-semibold text-muted hover:bg-black/5 disabled:opacity-50"
            onClick={() => {
              const comment = window.prompt("Причина отмены");
              void sendClientAction("cancel", comment ?? "");
            }}
          >
            Отменить
          </button>
        ) : null}
        {actionStatus === "error" ? (
          <span className="text-xs font-semibold text-red-600">Ошибка, попробуйте снова</span>
        ) : null}
      </div>
    </article>
  );
}

function PopularProductsSection({ products }: { products: Product[] }) {
  const { add } = useCart();

  if (products.length === 0) return null;

  return (
    <section className="mt-6 rounded-card bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase text-raspberry">Рекомендуем</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">Популярное у клиентов</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-xl bg-cream p-3"
          >
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-white">
              {product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-coral-light" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-black leading-tight text-dark">
                {product.name}
              </p>
              <p className="mt-1 text-base font-black text-coral">
                {product.price > 0 ? formatCurrency(product.price) : "По запросу"}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Добавить ${product.name} в корзину`}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-sm font-black text-white transition hover:bg-coral-hover"
              onClick={() => add(product, product.min_qty)}
            >
              +
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function SidebarBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-black/10 bg-white p-4">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[.07em] text-dark">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-black/5 py-1.5 text-xs last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-data font-medium text-dark">{value}</span>
    </div>
  );
}

function ConditionsBox({ state }: { state: CreditState }) {
  return (
    <SidebarBox title="Условия">
      <KvRow label="Кредитный лимит" value={formatCurrency(state.limit)} />
      <KvRow label="Статус" value={creditStatusLabels[state.status]} />
      {state.nextDueDate ? (
        <KvRow label="Ближайший платёж" value={formatDate(state.nextDueDate)} />
      ) : null}
      <button
        type="button"
        className="mt-3 w-full rounded border border-dashed border-black/20 py-2 text-xs font-semibold text-muted transition hover:border-coral hover:text-coral"
      >
        Запросить увеличение лимита
      </button>
    </SidebarBox>
  );
}

function RecentOrdersBox({ orders }: { orders: ClientOrderSummary[] }) {
  const recent = orders.filter((o) => o.order_items && o.order_items.length > 0).slice(0, 2);
  if (recent.length === 0) return null;

  return (
    <SidebarBox title="Быстрый повтор">
      {recent.map((order) => (
        <div
          key={order.id}
          className="flex items-center justify-between border-b border-dashed border-black/10 py-2 last:border-0"
        >
          <div>
            <p className="text-xs font-semibold text-dark">{order.order_number}</p>
            <p className="mt-0.5 font-data text-[11px] text-muted">
              {order.order_items!.length} поз. · {formatCurrency(order.total_amount)}
            </p>
          </div>
          <Link
            href="/catalog"
            className="rounded border border-dark bg-dark px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-dark/80"
          >
            В лист
          </Link>
        </div>
      ))}
      <Link
        href="/catalog"
        className="mt-3 block w-full rounded border border-dashed border-black/20 py-2 text-center text-xs font-semibold text-muted transition hover:border-coral hover:text-coral"
      >
        + Открыть каталог
      </Link>
    </SidebarBox>
  );
}

function DeliveryBox({ orders }: { orders: ClientOrderSummary[] }) {
  const lastWithAddress = orders.find((o) => o.delivery_address);
  if (!lastWithAddress?.delivery_address) return null;

  return (
    <SidebarBox title="Доставка">
      <KvRow label="Адрес" value={lastWithAddress.delivery_address} />
      {lastWithAddress.delivery_time ? (
        <KvRow label="Время" value={lastWithAddress.delivery_time} />
      ) : null}
    </SidebarBox>
  );
}

function ClientDashboard({
  session,
  onLogout,
  onUpdate,
  popularProducts = [],
}: {
  session: ClientSession;
  onLogout: () => void;
  onUpdate: (session: ClientSession) => void;
  popularProducts?: Product[];
}) {
  const [accountantPhone, setAccountantPhone] = useState(session.accountant_phone ?? "");
  const [companyName, setCompanyName] = useState(session.companyName);
  const [creditState, setCreditState] = useState<CreditState | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orders, setOrders] = useState<ClientOrderSummary[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [ordersTab, setOrdersTab] = useState<"active" | "all">("active");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile/credit", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { creditState?: CreditState | null }) => {
        if (data.creditState) setCreditState(data.creditState);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      setIsLoadingOrders(true);
      setOrdersError("");

      try {
        const response = await fetch("/api/profile/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: session.email,
            phone: session.phone,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to load orders");
        }

        const data = (await response.json()) as { orders?: ClientOrderSummary[] };

        if (isMounted) {
          setOrders(data.orders ?? []);
        }
      } catch {
        if (isMounted) {
          setOrders([]);
          setOrdersError("Не удалось загрузить историю заказов");
        }
      } finally {
        if (isMounted) {
          setIsLoadingOrders(false);
        }
      }
    }

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, [session.email, session.phone]);

  const doneStatuses = ["completed", "canceled", "cancelled"];
  const activeOrders = orders.filter((order) => !doneStatuses.includes(order.status)).length;
  const paidAmount = orders
    .filter((order) => order.status === "paid" || order.payment_status === "paid")
    .reduce((sum, order) => sum + order.total_amount, 0);
  const nextDelivery =
    orders
      .filter((o) => o.delivery_date && !doneStatuses.includes(o.status))
      .sort((a, b) => a.delivery_date!.localeCompare(b.delivery_date!))[0]?.delivery_date ?? null;
  const visibleOrders =
    ordersTab === "active" ? orders.filter((o) => !doneStatuses.includes(o.status)) : orders;

  function handleSave() {
    const nextSession: ClientSession = {
      ...session,
      companyName,
      accountant_phone: accountantPhone,
    };

    onUpdate(nextSession);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {session.companyName || "Кабинет партнёра"}
          </h1>
          <p className="mt-1 text-sm text-muted">{session.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalog" className="rounded border border-dark bg-dark px-4 py-2 text-sm font-semibold text-white hover:bg-dark/80">
            В каталог
          </Link>
          <Link href="/cart" className="rounded border border-black/20 px-4 py-2 text-sm font-semibold text-dark hover:bg-black/5">
            Корзина
          </Link>
          <button type="button" onClick={onLogout} className="rounded border border-black/20 px-4 py-2 text-sm font-semibold text-muted hover:bg-black/5">
            Выйти
          </button>
        </div>
      </div>

      {/* Credit block */}
      {creditState ? (
        <div className="mt-5">
          <CreditBlock state={creditState} />
        </div>
      ) : null}

      {/* 2-column main layout */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
        {/* Orders column */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-black/10 pb-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[.05em]">Заказы</h2>
            <button
              type="button"
              onClick={() => setOrdersTab(ordersTab === "active" ? "all" : "active")}
              className="text-xs font-semibold text-coral hover:underline"
            >
              {ordersTab === "active" ? "Все заказы →" : "← Активные"}
            </button>
          </div>

          {isLoadingOrders ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded border border-black/10 bg-white" />
              ))}
            </div>
          ) : ordersError ? (
            <div className="rounded border border-coral/30 bg-coral-light p-5">
              <p className="text-sm font-semibold text-burgundy">{ordersError}</p>
            </div>
          ) : visibleOrders.length > 0 ? (
            <div className="space-y-2">
              {visibleOrders.map((order) => (
                <ClientOrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-black/20 p-6 text-center">
              <p className="font-display text-lg font-semibold">Заказов пока нет</p>
              <p className="mt-2 text-sm text-muted">
                История подтягивается по email и телефону. Если заказ оформлялся на другой контакт — обратитесь к менеджеру.
              </p>
              <Link href="/catalog" className="mt-4 inline-block rounded border border-dark bg-dark px-4 py-2 text-sm font-semibold text-white hover:bg-dark/80">
                Открыть каталог
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <RecentOrdersBox orders={orders} />
          {creditState ? <ConditionsBox state={creditState} /> : null}
          <DeliveryBox orders={orders} />

          {/* Profile settings */}
          <SidebarBox title="Профиль">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Компания</p>
                <Input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.currentTarget.value)}
                  placeholder="Название компании"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Email</p>
                <p className="rounded border border-black/10 bg-cream px-3 py-2 text-xs font-medium text-muted">
                  {session.email}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">WhatsApp</p>
                <p className="rounded border border-black/10 bg-cream px-3 py-2 text-xs font-medium text-muted">
                  {session.phone || "Не указан"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Телефон бухгалтера</p>
                <Input
                  inputMode="tel"
                  value={accountantPhone}
                  onChange={(event) => setAccountantPhone(event.currentTarget.value)}
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded border border-dark bg-dark px-4 py-2 text-xs font-semibold text-white hover:bg-dark/80"
                >
                  Сохранить
                </button>
                {saved ? <span className="text-xs font-semibold text-coral">Сохранено</span> : null}
              </div>
            </div>
          </SidebarBox>
        </aside>
      </div>

      <PopularProductsSection products={popularProducts} />
    </section>
  );
}

export function ProfileClient({ popularProducts = [] }: { popularProducts?: Product[] }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<ProfileSession | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      // Check admin session
      try {
        const response = await fetch("/api/profile/session", { cache: "no-store" });
        const adminData = (await response.json()) as ProfileSessionResponse;

        if (isMounted && adminData.authenticated && adminData.role === "admin") {
          setSession({ email: adminData.email ?? "", role: "admin" });
          return;
        }
      } catch {}

      // Check client session cookie
      try {
        const response = await fetch("/api/profile/client-session", { cache: "no-store" });
        const clientData = (await response.json()) as ClientSessionResponse;

        if (isMounted && clientData.authenticated && clientData.email) {
          setSession({
            email: clientData.email,
            phone: clientData.phone ?? "",
            companyName: clientData.companyName ?? "",
            accountant_phone: clientData.accountantPhone ?? "",
            createdAt: new Date().toISOString(),
            role: "client",
          });
          return;
        }
      } catch {}

      if (isMounted) {
        setSession(null);
      }
    }

    loadSession().finally(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogout() {
    if (session?.role === "admin") {
      await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
      router.refresh();
    } else {
      await fetch("/api/profile/client-logout", { method: "POST" }).catch(() => undefined);
    }

    setSession(null);
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      {isLoading ? (
        <section className="mx-auto max-w-6xl">
          <div className="h-72 animate-pulse rounded-card bg-white shadow-sm" />
        </section>
      ) : session?.role === "admin" ? (
        <AdminDashboard session={session} onLogout={() => void handleLogout()} />
      ) : session?.role === "client" ? (
        <ClientDashboard session={session} onLogout={() => void handleLogout()} onUpdate={setSession} popularProducts={popularProducts} />
      ) : (
        <LoginPanel onLogin={setSession} />
      )}
    </main>
  );
}
