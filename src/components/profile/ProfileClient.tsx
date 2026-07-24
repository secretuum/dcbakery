"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/src/components/ui/Button";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { Input } from "@/src/components/ui/Input";
import { clientOrderStatusLabels, creditStatusLabels, orderStatusLabels } from "@/src/lib/order-status";
import { useCart } from "@/src/contexts/CartContext";
import { useT } from "@/src/i18n/client";
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

function LoginPanel({ onLogin }: { onLogin: (session: ProfileSession) => void }) {
  const t = useT();
  // Admin section state
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  // Client login/registration state
  const [clientLogin, setClientLogin] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regBin, setRegBin] = useState("");
  const [regName, setRegName] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [clientError, setClientError] = useState("");
  const [clientNotice, setClientNotice] = useState("");
  const [clientStep, setClientStep] = useState<
    "idle" | "signing_in" | "register" | "registering" | "confirm_sent" | "forgot" | "sending_reset" | "reset_sent"
  >("idle");

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

  function openRegistration(prefillLogin?: string) {
    if (prefillLogin) {
      if (prefillLogin.includes("@")) {
        setRegEmail(prefillLogin.trim().toLowerCase());
      } else {
        setRegPhone(prefillLogin.trim());
      }
    }

    setClientError("");
    setClientStep("register");
  }

  async function handleClientLogin() {
    if (!clientLogin.trim() || !clientPassword) {
      setClientError(t("Введите логин и пароль"));
      return;
    }

    setClientError("");
    setClientStep("signing_in");

    try {
      const response = await fetch("/api/profile/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: clientLogin.trim(), password: clientPassword }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        notRegistered?: boolean;
        ok?: boolean;
        email?: string;
        phone?: string;
        companyName?: string;
        accountantPhone?: string;
      };

      if (response.ok && data.notRegistered) {
        // Аккаунта нет в базе — не пропускаем и переводим на регистрацию
        setClientNotice(t("Такой аккаунт не найден. Заполните регистрацию — и сразу попадёте в кабинет."));
        openRegistration(clientLogin);
        return;
      }

      if (!response.ok || !data.ok) {
        setClientError(data.error ?? t("Не удалось войти"));
        setClientStep("idle");
        return;
      }

      onLogin({
        role: "client",
        email: data.email ?? "",
        phone: data.phone ?? "",
        companyName: data.companyName ?? "",
        accountant_phone: data.accountantPhone || undefined,
        createdAt: "",
      });
    } catch {
      setClientError(t("Не удалось войти. Проверьте соединение"));
      setClientStep("idle");
    }
  }

  async function handleClientRegister() {
    if (!regEmail.includes("@")) {
      setClientError(t("Введите корректный email"));
      return;
    }

    if (regPhone.replace(/\D/g, "").length < 11) {
      setClientError(t("Введите полный номер телефона"));
      return;
    }

    if (regPassword.length < 8) {
      setClientError(t("Пароль должен быть не короче 8 символов"));
      return;
    }

    if (!regCompany.trim()) {
      setClientError(t("Укажите название компании"));
      return;
    }

    if (regBin.replace(/\D/g, "").length !== 12) {
      setClientError(t("БИН/ИИН — 12 цифр"));
      return;
    }

    setClientError("");
    setClientStep("registering");

    try {
      const response = await fetch("/api/profile/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          phone: regPhone,
          password: regPassword,
          companyName: regCompany,
          customerBin: regBin,
          customerName: regName,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        needsEmailConfirm?: boolean;
        email?: string;
        phone?: string;
        companyName?: string;
      };

      if (!response.ok || !data.ok) {
        setClientError(data.error ?? t("Не удалось создать аккаунт"));
        setClientStep("register");
        return;
      }

      if (data.needsEmailConfirm) {
        // Аккаунт создан, но почту нужно подтвердить по письму
        setClientStep("confirm_sent");
        return;
      }

      onLogin({
        role: "client",
        email: data.email ?? "",
        phone: data.phone ?? "",
        companyName: data.companyName ?? "",
        createdAt: "",
      });
    } catch {
      setClientError(t("Не удалось создать аккаунт. Проверьте соединение"));
      setClientStep("register");
    }
  }

  async function handleForgotPassword() {
    if (!resetEmail.includes("@")) {
      setClientError(t("Введите email, указанный при регистрации"));
      return;
    }

    setClientError("");
    setClientStep("sending_reset");

    try {
      const response = await fetch("/api/profile/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };

      if (!response.ok || !data.ok) {
        setClientError(data.error ?? t("Не удалось отправить письмо"));
        setClientStep("forgot");
        return;
      }

      setClientStep("reset_sent");
    } catch {
      setClientError("Не удалось отправить письмо. Проверьте соединение");
      setClientStep("forgot");
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <p className="text-sm font-bold uppercase text-raspberry">{t("Профиль")}</p>
      <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{t("Вход в кабинет")}</h1>

      <div className="mt-8 grid gap-4">
        {/* Client login / registration */}
        <div className="rounded-card bg-white p-6 shadow-sm">
          {clientStep === "confirm_sent" ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight">{t("Подтвердите почту")}</h2>
              <div className="mt-4 rounded-xl bg-green-50 p-4">
                <p className="text-sm font-bold text-green-700">{t("Аккаунт создан")}</p>
                <p className="mt-1 text-sm font-semibold text-green-600/80">{t("Мы отправили письмо на")}<span className="font-bold">{regEmail}</span>{t(". Перейдите по ссылке из письма, затем войдите с паролем.")}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={() => {
                  setClientStep("idle");
                  setClientError("");
                  setClientNotice("");
                }}
              >{t("К форме входа")}</Button>
            </>
          ) : clientStep === "reset_sent" ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight">{t("Проверьте почту")}</h2>
              <div className="mt-4 rounded-xl bg-green-50 p-4">
                <p className="text-sm font-bold text-green-700">{t("Письмо отправлено")}</p>
                <p className="mt-1 text-sm font-semibold text-green-600/80">{t("Если почта")}<span className="font-bold">{resetEmail}</span>{t("зарегистрирована, на неё придёт ссылка для установки нового пароля.")}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={() => {
                  setClientStep("idle");
                  setClientError("");
                }}
              >{t("К форме входа")}</Button>
            </>
          ) : clientStep === "forgot" || clientStep === "sending_reset" ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight">{t("Сброс пароля")}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{t("Укажите почту, на которую регистрировались, — пришлём ссылку для нового пароля.")}</p>
              <label className="mt-4 block">
                <span className="text-sm font-bold text-dark">Email</span>
                <Input
                  className="mt-2"
                  inputMode="email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleForgotPassword();
                    }
                  }}
                  placeholder="company@example.com"
                  autoFocus
                />
              </label>
              {clientError ? (
                <p className="mt-3 text-sm font-bold text-burgundy">{clientError}</p>
              ) : null}
              <div className="mt-5 flex gap-3">
                <Button
                  type="button"
                  disabled={clientStep === "sending_reset"}
                  className="flex-1"
                  onClick={() => void handleForgotPassword()}
                >
                  {clientStep === "sending_reset" ? t("Отправляем...") : t("Отправить письмо")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setClientStep("idle");
                    setClientError("");
                  }}
                >{t("Назад")}</Button>
              </div>
            </>
          ) : clientStep === "register" || clientStep === "registering" ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight">{t("Регистрация")}</h2>
              {clientNotice ? (
                <div className="mt-4 rounded-xl border border-coral/20 bg-coral-light px-4 py-3">
                  <p className="text-sm font-semibold text-dark/80">{clientNotice}</p>
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-bold text-dark">Email</span>
                  <Input
                    className="mt-2"
                    inputMode="email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.currentTarget.value)}
                    placeholder="company@example.com"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-dark">{t("Телефон WhatsApp")}</span>
                  <Input
                    className="mt-2"
                    inputMode="tel"
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.currentTarget.value)}
                    placeholder="+7 (747) 000-00-00"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-dark">{t("Пароль")}</span>
                  <Input
                    className="mt-2"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.currentTarget.value)}
                    placeholder={t("Минимум 8 символов")}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-dark">{t("Компания / заведение")}</span>
                  <Input
                    className="mt-2"
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.currentTarget.value)}
                    placeholder={t("Название компании")}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-dark">{t("БИН / ИИН")}</span>
                  <Input
                    className="mt-2"
                    inputMode="numeric"
                    value={regBin}
                    onChange={(e) => setRegBin(e.currentTarget.value)}
                    placeholder={t("12 цифр")}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-dark">{t("Контактное лицо")}</span>
                  <Input
                    className="mt-2"
                    value={regName}
                    onChange={(e) => setRegName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleClientRegister();
                      }
                    }}
                    placeholder={t("Имя и фамилия")}
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
                  onClick={() => void handleClientRegister()}
                >
                  {clientStep === "registering" ? t("Создаём аккаунт...") : t("Зарегистрироваться")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setClientStep("idle");
                    setClientError("");
                    setClientNotice("");
                  }}
                >{t("Назад")}</Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight">{t("Вход")}</h2>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-bold text-dark">{t("Почта или номер телефона")}</span>
                  <Input
                    className="mt-2"
                    value={clientLogin}
                    onChange={(e) => setClientLogin(e.currentTarget.value)}
                    placeholder={t("company@example.com или +7 (747) 000-00-00")}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-dark">{t("Пароль")}</span>
                  <Input
                    className="mt-2"
                    type="password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleClientLogin();
                      }
                    }}
                    placeholder="••••••••"
                  />
                </label>
              </div>
              {clientError ? (
                <p className="mt-3 text-sm font-bold text-burgundy">{clientError}</p>
              ) : null}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  disabled={clientStep === "signing_in"}
                  className="flex-1"
                  onClick={() => void handleClientLogin()}
                >
                  {clientStep === "signing_in" ? t("Проверяем...") : t("Войти")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openRegistration()}
                >{t("Зарегистрироваться")}</Button>
              </div>
              <button
                type="button"
                className="mt-4 text-sm font-semibold text-muted underline-offset-2 hover:text-dark hover:underline"
                onClick={() => {
                  if (clientLogin.includes("@")) {
                    setResetEmail(clientLogin.trim().toLowerCase());
                  }
                  setClientError("");
                  setClientStep("forgot");
                }}
              >{t("Забыли пароль?")}</button>
            </>
          )}
        </div>

        {/* Admin form */}
        <form onSubmit={(e) => void handleAdminSubmit(e)} className="rounded-card bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight">{t("Email и пароль")}</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-dark">Email</span>
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
              <span className="text-sm font-bold text-dark">{t("Пароль")}</span>
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
            {isAdminSubmitting ? t("Проверяем...") : t("Войти как менеджер")}
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
  const t = useT();
  const [previewMode, setPreviewMode] = useState(false);

  if (previewMode) {
    return (
      <div>
        <div className="print-hidden mb-4 flex items-center justify-between rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-700">{t("Режим превью — вид клиента")}</p>
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setPreviewMode(false)}
          >{t("Выйти из превью")}</Button>
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-dark px-5 py-4 text-white shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-coral">{t("Админ-профиль")}</p>
          <p className="mt-1 break-all text-sm font-semibold text-white/70">{session.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white text-white hover:bg-white/10"
            onClick={() => setPreviewMode(true)}
          >{t("Вид клиента")}</Button>
          <Button type="button" variant="ghost" className="text-white hover:bg-white/10" onClick={onLogout}>{t("Выйти")}</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/orders"
          className="rounded-card bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-bold uppercase text-raspberry">{t("Операции")}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{t("Заказы")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Новые заявки, подтверждение, оплата и статусы доставки.
          </p>
        </Link>
        <Link
          href="/admin/documents"
          className="rounded-card bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-bold uppercase text-raspberry">{t("Документы")}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{t("Накладные и счета")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Счёт и накладная по каждому заказу в один клик.
          </p>
        </Link>
        <Link
          href="/admin/clients"
          className="rounded-card bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-bold uppercase text-raspberry">{t("Партнёры")}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{t("Наши клиенты")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Компании, контакты, лимиты и история заказов.
          </p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-card bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-bold uppercase text-raspberry">{t("Каталог")}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{t("Товары")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Цены, остатки, фото и активность позиций.
          </p>
        </Link>
        <Link
          href="/admin/stop-list"
          className="rounded-card bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-bold uppercase text-raspberry">{t("Наличие")}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{t("Стоп-лист")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Временно снятые с продажи позиции.
          </p>
        </Link>
        <Link
          href="/admin/settings"
          className="rounded-card bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-bold uppercase text-raspberry">{t("Система")}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{t("Настройки")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Контент сайта, режим редактирования и платежи.
          </p>
        </Link>
      </div>
    </section>
  );
}

function CreditBlock({ state }: { state: CreditState }) {
  const t = useT();
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
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">{t("Товарный кредит")}</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">{t("Доступно сейчас")}</p>
          <p className="mt-2 font-data text-2xl font-semibold leading-none text-green-700">
            {formatCurrency(state.available)}
          </p>
          <p className="mt-2 text-[11px] text-muted">{t(creditStatusLabels[state.status])}</p>
        </div>

        {/* Cell 3 — платёж */}
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">{t("Ближайший платёж")}</p>
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
            <b className="font-semibold">{t("Просрочка ${days} дн.", { days: state.overdueDays })}</b>{" "}
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
            <span className="shrink-0 font-bold text-dark">{formatCurrency(item.total_amount)}</span>
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
  const t = useT();
  const orderStatus =
    t(clientOrderStatusLabels[order.status] ?? orderStatusLabels[order.status] ?? order.status);
  const chipClass = ORDER_CHIP[order.status] ?? "bg-black/5 text-muted";
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    order.due_date && order.due_date < today && order.payment_status !== "paid";
  const overdueDays = isOverdue
    ? Math.floor((Date.parse(today) - Date.parse(order.due_date!)) / 86_400_000)
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
          <span>{t("Отгрузка")}<b className="font-data font-medium text-dark">{formatDate(order.delivery_date)}</b></span>
        ) : null}
        {order.order_items?.length ? (
          <span>{t("Позиций")}<b className="font-data font-medium text-dark">{order.order_items.length}</b></span>
        ) : null}
        {order.due_date ? (
          <span className={isOverdue ? "text-red-600 font-semibold" : ""}>{t("Оплата до")}<b className="font-data font-medium">{formatDate(order.due_date)}</b>
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
          >{t("Принять изменения")}</button>
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
          >{t("Изменить")}</button>
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
            <Link href={`/documents/invoice/${order.id}`} className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5">{t("Счет PDF")}</Link>
            <Link href={`/documents/nakl/${order.id}`} className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5">{t("Накладная PDF")}</Link>
          </>
        ) : null}
        <Link href="/catalog" className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold text-dark hover:bg-black/5">{t("Повторить")}</Link>
        {canCancel ? (
          <button
            type="button"
            disabled={actionStatus === "loading"}
            className="rounded px-3 py-1.5 text-xs font-semibold text-muted hover:bg-black/5 disabled:opacity-50"
            onClick={() => {
              const comment = window.prompt("Причина отмены");
              void sendClientAction("cancel", comment ?? "");
            }}
          >{t("Отменить")}</button>
        ) : null}
        {actionStatus === "error" ? (
          <span className="text-xs font-semibold text-red-600">{t("Ошибка, попробуйте снова")}</span>
        ) : null}
      </div>
    </article>
  );
}

function PopularProductsSection({ products }: { products: Product[] }) {
  const t = useT();
  const { add } = useCart();

  if (products.length === 0) return null;

  return (
    <section className="mt-6 rounded-card bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase text-raspberry">{t("Рекомендуем")}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight">{t("Популярное у клиентов")}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-xl bg-cream p-3"
          >
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-white">
              <FallbackImage
                src={product.images[0]}
                alt={product.name}
                categoryId={product.category_id}
                categorySlug={product.category?.slug}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold leading-tight text-dark">
                {product.name}
              </p>
              <p className="mt-1 text-base font-bold text-coral">
                {product.price > 0 ? formatCurrency(product.price) : "По запросу"}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Добавить ${product.name} в корзину`}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-coral text-sm font-bold text-white transition hover:bg-coral-hover"
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
  const t = useT();
  return (
    <SidebarBox title={t("Условия")}>
      <KvRow label={t("Кредитный лимит")} value={formatCurrency(state.limit)} />
      <KvRow label={t("Статус")} value={t(creditStatusLabels[state.status])} />
      {state.nextDueDate ? (
        <KvRow label={t("Ближайший платёж")} value={formatDate(state.nextDueDate)} />
      ) : null}
      <button
        type="button"
        className="mt-3 w-full rounded border border-dashed border-black/20 py-2 text-xs font-semibold text-muted transition hover:border-coral hover:text-coral"
      >{t("Запросить увеличение лимита")}</button>
    </SidebarBox>
  );
}

function RecentOrdersBox({ orders }: { orders: ClientOrderSummary[] }) {
  const t = useT();
  const recent = orders.filter((o) => o.order_items && o.order_items.length > 0).slice(0, 2);
  if (recent.length === 0) return null;

  return (
    <SidebarBox title={t("Быстрый повтор")}>
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
          >{t("В лист")}</Link>
        </div>
      ))}
      <Link
        href="/catalog"
        className="mt-3 block w-full rounded border border-dashed border-black/20 py-2 text-center text-xs font-semibold text-muted transition hover:border-coral hover:text-coral"
      >{t("+ Открыть каталог")}</Link>
    </SidebarBox>
  );
}

function DeliveryBox({ orders }: { orders: ClientOrderSummary[] }) {
  const t = useT();
  const lastWithAddress = orders.find((o) => o.delivery_address);
  if (!lastWithAddress?.delivery_address) return null;

  return (
    <SidebarBox title={t("Доставка")}>
      <KvRow label={t("Адрес")} value={lastWithAddress.delivery_address} />
      {lastWithAddress.delivery_time ? (
        <KvRow label={t("Время")} value={lastWithAddress.delivery_time} />
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
  const t = useT();
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
          <Link href="/catalog" className="rounded border border-dark bg-dark px-4 py-2 text-sm font-semibold text-white hover:bg-dark/80">{t("В каталог")}</Link>
          <Link href="/cart" className="rounded border border-black/20 px-4 py-2 text-sm font-semibold text-dark hover:bg-black/5">{t("Корзина")}</Link>
          <button type="button" onClick={onLogout} className="rounded border border-black/20 px-4 py-2 text-sm font-semibold text-muted hover:bg-black/5">{t("Выйти")}</button>
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
            <h2 className="font-display text-sm font-semibold uppercase tracking-[.05em]">{t("Заказы")}</h2>
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
              <p className="font-display text-lg font-semibold">{t("Заказов пока нет")}</p>
              <p className="mt-2 text-sm text-muted">{t("История подтягивается по email и телефону. Если заказ оформлялся на другой контакт — обратитесь к менеджеру.")}</p>
              <Link href="/catalog" className="mt-4 inline-block rounded border border-dark bg-dark px-4 py-2 text-sm font-semibold text-white hover:bg-dark/80">{t("Открыть каталог")}</Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <RecentOrdersBox orders={orders} />
          {creditState ? <ConditionsBox state={creditState} /> : null}
          <DeliveryBox orders={orders} />

          {/* Profile settings */}
          <SidebarBox title={t("Профиль")}>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">{t("Компания")}</p>
                <Input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.currentTarget.value)}
                  placeholder={t("Название компании")}
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
                <p className="mb-1 text-xs font-semibold text-muted">{t("Телефон бухгалтера")}</p>
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
                >{t("Сохранить")}</button>
                {saved ? <span className="text-xs font-semibold text-coral">{t("Сохранено")}</span> : null}
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
