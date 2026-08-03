"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/src/components/ui/Button";
import { FallbackImage } from "@/src/components/ui/FallbackImage";
import { Input } from "@/src/components/ui/Input";
import { isValidBin } from "@/src/lib/bin";
import { isValidKzMobile } from "@/src/lib/phone";
import { clientOrderStatusLabels, creditStatusLabels, orderStatusLabels } from "@/src/lib/order-status";
import { HomeReward } from "@/src/components/home/HomeReward";
import { weeklyPromoCollected } from "@/src/lib/promo";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
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
  phoneVerified?: boolean;
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
  phoneVerified?: boolean;
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

function formatMmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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
    | "idle"
    | "signing_in"
    | "register"
    | "registering"
    | "otp"
    | "verifying"
    | "confirm_sent"
    | "forgot"
    | "sending_reset"
    | "reset_sent"
  >("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [otpResending, setOtpResending] = useState(false);

  // Обратный отсчёт срока WhatsApp-кода на шаге ввода.
  useEffect(() => {
    if (clientStep !== "otp") return;
    const id = window.setInterval(() => setOtpSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [clientStep]);

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

    if (!isValidKzMobile(regPhone)) {
      setClientError(t("Введите корректный мобильный номер, например +7 705 123 45 67"));
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

    if (regBin.trim() && !isValidBin(regBin)) {
      setClientError(t("БИН/ИИН указан неверно — проверьте 12 цифр"));
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
        needsOtp?: boolean;
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

      if (data.needsOtp) {
        // Код ушёл в WhatsApp — переходим к вводу кода
        setOtpCode("");
        setOtpSeconds(120);
        setClientError("");
        setClientStep("otp");
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

  async function handleVerifyOtp() {
    const code = otpCode.replace(/\D/g, "");

    if (code.length !== 6) {
      setClientError(t("Введите 6-значный код из WhatsApp"));
      return;
    }

    setClientError("");
    setClientStep("verifying");

    try {
      const response = await fetch("/api/profile/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        email?: string;
        phone?: string;
        companyName?: string;
      };

      if (!response.ok || !data.ok) {
        setClientError(data.error ?? t("Неверный код"));
        setClientStep("otp");
        return;
      }

      onLogin({
        role: "client",
        email: data.email ?? regEmail.trim().toLowerCase(),
        phone: data.phone ?? regPhone,
        companyName: data.companyName ?? regCompany,
        phoneVerified: true,
        createdAt: "",
      });
    } catch {
      setClientError(t("Не удалось проверить код. Проверьте соединение"));
      setClientStep("otp");
    }
  }

  async function handleResendOtp() {
    if (otpResending) return;

    setOtpResending(true);
    setClientError("");

    try {
      const response = await fetch("/api/profile/otp/resend", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };

      if (!response.ok || !data.ok) {
        setClientError(data.error ?? t("Не удалось отправить код"));
        return;
      }

      setOtpCode("");
      setOtpSeconds(120);
    } catch {
      setClientError(t("Не удалось отправить код. Проверьте соединение"));
    } finally {
      setOtpResending(false);
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
    <section className="mx-auto max-w-[468px]">
      {/* Client login / registration — auth card */}
      <div className="rounded-2xl bg-white p-6 shadow-md sm:p-8">
        {clientStep === "confirm_sent" ? (
          <>
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-dark">{t("Подтвердите почту")}</h2>
            </div>
            <div className="mt-6 rounded-md bg-success-bg p-4">
              <p className="text-sm font-bold text-success">{t("Аккаунт создан")}</p>
              <p className="mt-1 text-sm font-semibold text-success/80">{t("Мы отправили письмо на")}<span className="font-bold">{regEmail}</span>{t(". Перейдите по ссылке из письма, затем войдите с паролем.")}</p>
            </div>
            <div className="mt-6 border-t border-black/10 pt-5">
              <Button
                type="button"
                variant="outline"
                block
                onClick={() => {
                  setClientStep("idle");
                  setClientError("");
                  setClientNotice("");
                }}
              >{t("К форме входа")}</Button>
            </div>
          </>
        ) : clientStep === "otp" || clientStep === "verifying" ? (
          <>
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-dark">{t("Введите код из WhatsApp")}</h2>
            </div>
            <div className="mt-6 rounded-md bg-success-bg p-4">
              <p className="text-sm font-bold text-success">{t("Код отправлен в WhatsApp")}</p>
              <p className="mt-1 text-sm font-semibold text-success/80">
                {t("Мы написали на ")}<span className="font-bold">{regPhone}</span>{t(". Введите 6-значный код — он действует 2 минуты.")}
              </p>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-bold text-dark">{t("Код подтверждения")}</span>
              <Input
                className="mt-2 text-center font-data text-2xl tracking-[.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleVerifyOtp();
                  }
                }}
                placeholder="000000"
                autoFocus
              />
            </label>
            {clientError ? (
              <p className="mt-3 text-sm font-bold text-burgundy">{clientError}</p>
            ) : null}
            <p className="mt-2 text-xs font-semibold text-muted">
              {otpSeconds > 0
                ? t("Код действует ещё ${time}", { time: formatMmss(otpSeconds) })
                : t("Срок кода истёк — запросите новый.")}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                disabled={clientStep === "verifying" || otpCode.length !== 6}
                className="flex-1"
                onClick={() => void handleVerifyOtp()}
              >
                {clientStep === "verifying" ? t("Проверяем...") : t("Подтвердить")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={otpResending || otpSeconds > 90}
                onClick={() => void handleResendOtp()}
              >
                {otpResending ? t("Отправляем...") : t("Отправить снова")}
              </Button>
            </div>
            <div className="mt-6 border-t border-black/10 pt-5 text-center">
              <button
                type="button"
                className="text-sm font-semibold text-muted underline-offset-2 hover:text-dark hover:underline"
                onClick={() => {
                  setClientStep("idle");
                  setClientError("");
                  setClientNotice("");
                }}
              >{t("Назад ко входу")}</button>
            </div>
          </>
        ) : clientStep === "reset_sent" ? (
          <>
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-dark">{t("Проверьте почту")}</h2>
            </div>
            <div className="mt-6 rounded-md bg-success-bg p-4">
              <p className="text-sm font-bold text-success">{t("Письмо отправлено")}</p>
              <p className="mt-1 text-sm font-semibold text-success/80">{t("Если почта")}<span className="font-bold">{resetEmail}</span>{t("зарегистрирована, на неё придёт ссылка для установки нового пароля.")}</p>
            </div>
            <div className="mt-6 border-t border-black/10 pt-5">
              <Button
                type="button"
                variant="outline"
                block
                onClick={() => {
                  setClientStep("idle");
                  setClientError("");
                }}
              >{t("К форме входа")}</Button>
            </div>
          </>
        ) : clientStep === "forgot" || clientStep === "sending_reset" ? (
          <>
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-dark">{t("Сброс пароля")}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-muted">{t("Укажите почту, на которую регистрировались, — пришлём ссылку для нового пароля.")}</p>
            </div>
            <label className="mt-5 block">
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
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-dark">{t("Регистрация")}</h2>
            </div>
            {clientNotice ? (
              <div className="mt-6 rounded-md border border-coral/20 bg-accent-50 px-4 py-3">
                <p className="text-sm font-semibold text-dark/80">{clientNotice}</p>
              </div>
            ) : null}
            <div className="mt-6 space-y-3">
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
                {regPhone.trim() && !isValidKzMobile(regPhone) ? (
                  <p className="mt-1 text-xs font-semibold text-raspberry">
                    {t("Похоже на некорректный номер. Формат: +7 705 123 45 67")}
                  </p>
                ) : null}
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
                {regBin.trim() && !isValidBin(regBin) ? (
                  <p className="mt-1 text-xs font-semibold text-raspberry">
                    {t("БИН/ИИН указан неверно — проверьте 12 цифр")}
                  </p>
                ) : null}
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
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[.08em] text-raspberry">{t("Профиль")}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-dark">{t("Вход в кабинет")}</h2>
            </div>
            <div className="mt-6 space-y-3">
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
            <div className="mt-6 border-t border-black/10 pt-5 text-center">
              <button
                type="button"
                className="text-sm font-semibold text-muted underline-offset-2 hover:text-dark hover:underline"
                onClick={() => {
                  if (clientLogin.includes("@")) {
                    setResetEmail(clientLogin.trim().toLowerCase());
                  }
                  setClientError("");
                  setClientStep("forgot");
                }}
              >{t("Забыли пароль?")}</button>
            </div>
          </>
        )}
      </div>

      {/* Admin form — compact auth card */}
      <form onSubmit={(e) => void handleAdminSubmit(e)} className="mt-4 rounded-2xl bg-white p-6 shadow-md sm:p-8">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold tracking-tight text-dark">{t("Email и пароль")}</h2>
        </div>
        <div className="mt-6 space-y-3">
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
        <Button type="submit" disabled={isAdminSubmitting} variant="outline" block className="mt-5">
          {isAdminSubmitting ? t("Проверяем...") : t("Войти как менеджер")}
        </Button>
      </form>
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
        <div className="print-hidden mb-4 flex items-center justify-between rounded-xl border border-warning/30 bg-warning-bg px-4 py-3">
          <p className="text-sm font-bold text-warning">{t("Режим превью — вид клиента")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-warning/40 text-warning hover:bg-warning/10"
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
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-6 py-5 text-white shadow-md"
        style={{ background: "linear-gradient(135deg, var(--color-espresso), color-mix(in srgb, var(--color-espresso) 82%, black))" }}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.08em] text-coral">{t("Админ-профиль")}</p>
          <p className="mt-1 break-all text-sm font-semibold text-white/70">{session.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => setPreviewMode(true)}
          >{t("Вид клиента")}</Button>
          <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onLogout}>{t("Выйти")}</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/orders"
          className="rounded-xl bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-[.06em] text-raspberry">{t("Операции")}</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-dark">{t("Заказы")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Новые заявки, подтверждение, оплата и статусы доставки.
          </p>
        </Link>
        <Link
          href="/admin/documents"
          className="rounded-xl bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-[.06em] text-raspberry">{t("Документы")}</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-dark">{t("Накладные и счета")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Счёт и накладная по каждому заказу в один клик.
          </p>
        </Link>
        <Link
          href="/admin/clients"
          className="rounded-xl bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-[.06em] text-raspberry">{t("Партнёры")}</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-dark">{t("Наши клиенты")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Компании, контакты, лимиты и история заказов.
          </p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-xl bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-[.06em] text-raspberry">{t("Каталог")}</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-dark">{t("Товары")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Цены, остатки, фото и активность позиций.
          </p>
        </Link>
        <Link
          href="/admin/stop-list"
          className="rounded-xl bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-[.06em] text-raspberry">{t("Наличие")}</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-dark">{t("Стоп-лист")}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Временно снятые с продажи позиции.
          </p>
        </Link>
        <Link
          href="/admin/settings"
          className="rounded-xl bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-[.06em] text-raspberry">{t("Система")}</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-dark">{t("Настройки")}</h2>
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
    <div className="overflow-hidden rounded-xl bg-white shadow-xs">
      <div className="grid divide-y divide-black/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {/* Cell 1 — лимит + бар */}
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">{t("Доступный лимит")}</p>
          <p className="mt-2 font-data text-2xl font-semibold leading-none text-dark">
            {formatCurrency(state.used)}
            <span className="ml-1.5 text-sm font-normal text-muted">
              / {formatCurrency(state.limit)}
            </span>
          </p>
          {state.limit > 0 ? (
            <>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full bg-espresso" style={{ width: `${inTimePct}%` }} />
                <div className="h-full bg-danger" style={{ width: `${overduePct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-espresso" />
                  В срок {formatCurrency(state.used - state.overdue)}
                </span>
                {state.overdue > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-1.5 rounded-full bg-danger" />
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
          <p className="mt-2 font-data text-2xl font-semibold leading-none text-success">
            {formatCurrency(state.available)}
          </p>
          <p className="mt-2 text-[11px] text-muted">{t(creditStatusLabels[state.status])}</p>
        </div>

        {/* Cell 3 — платёж */}
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted">{t("Ближайший платёж")}</p>
          <p
            className={`mt-2 font-data text-2xl font-semibold leading-none text-dark ${
              state.overdueDays > 0 ? "text-danger" : ""
            }`}
          >
            {state.nextDueDate ? formatDate(state.nextDueDate) : "—"}
          </p>
          {state.overdueDays > 0 ? (
            <p className="mt-2 text-[11px] font-semibold text-danger">
              Просрочка {state.overdueDays} дн · {formatCurrency(state.overdue)}
            </p>
          ) : null}
          {state.penalty > 0 ? (
            <p className="mt-1 text-[11px] text-muted">
              {t("Пеня")} {state.penaltyRatePct}%/{t("день")} · ~{formatCurrency(state.penalty)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Алерт просрочки */}
      {state.overdueDays > 0 ? (
        <div className="flex items-start gap-3 border-t border-danger/15 bg-danger-bg px-5 py-3 text-sm text-danger">
          <svg className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" />
          </svg>
          <span>
            <b className="font-semibold">{t("Просрочка ${days} дн.", { days: state.overdueDays })}</b>{" "}
            Отгрузки приостановлены до погашения {formatCurrency(state.overdue)}.
            {state.penalty > 0 ? (
              <>
                {" "}
                {t("Начисляется пеня ${rate}%/день (оферта §11.2), ориентировочно ${sum}; точная сумма — по акту сверки.", {
                  rate: state.penaltyRatePct,
                  sum: formatCurrency(state.penalty),
                })}
              </>
            ) : null}
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
  pending_manager_confirmation: "bg-warning-bg text-warning",
  change_proposed: "bg-warning-bg text-warning",
  confirmed_waiting_payment: "bg-accent-50 text-burgundy",
  delivering: "bg-accent-50 text-accent-700",
  paid: "bg-success-bg text-success",
  completed: "bg-success-bg text-success",
  canceled: "bg-black/5 text-muted",
  cancelled: "bg-black/5 text-muted",
};

// Повтор заказа: сервер отдаёт актуальные товары (цена/остаток) по orderId, кладём в
// корзину и ведём в /cart. Общий хук для карточки заказа и сайдбара «Быстрый повтор».
function useReorder() {
  const t = useT();
  const { add } = useCart();
  const router = useRouter();
  const { showToast } = useToast();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  async function reorder(orderId: string) {
    setReorderingId(orderId);
    try {
      const response = await fetch("/api/profile/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) throw new Error("reorder failed");
      const data = (await response.json()) as {
        items?: { product: Product; qty: number }[];
        skipped?: number;
      };
      const list = data.items ?? [];
      if (list.length === 0) {
        showToast(t("Товары из этого заказа сейчас недоступны"), "error");
        return;
      }
      for (const { product, qty } of list) add(product, qty);
      showToast(
        data.skipped ? t("Добавлено в корзину, часть позиций недоступна") : t("Добавлено в корзину"),
        "success",
      );
      router.push("/cart");
    } catch {
      showToast(t("Не удалось повторить заказ"), "error");
    } finally {
      setReorderingId(null);
    }
  }

  return { reorder, reorderingId };
}

function ClientOrderCard({ order }: { order: ClientOrderSummary }) {
  const t = useT();
  const { reorder, reorderingId } = useReorder();
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
    !["delivering", "paid", "completed", "canceled", "cancelled"].includes(order.status);
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
    <article className="overflow-hidden rounded-xl bg-white p-4 shadow-xs transition-shadow hover:shadow-md sm:p-5">
      {/* Top row */}
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <span className="font-data text-sm font-semibold text-dark">{order.order_number}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.05em] ${chipClass}`}>
          {orderStatus}
        </span>
        <span className="ml-auto font-display font-semibold text-dark">{formatCurrency(order.total_amount)}</span>
        <span className="text-[10px] text-muted">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-black/5 pt-3 text-xs text-muted">
        {order.delivery_date ? (
          <span>{t("Отгрузка")}<b className="font-data font-medium text-dark">{formatDate(order.delivery_date)}</b></span>
        ) : null}
        {order.order_items?.length ? (
          <span>{t("Позиций")}<b className="font-data font-medium text-dark">{order.order_items.length}</b></span>
        ) : null}
        {order.due_date ? (
          <span className={isOverdue ? "font-semibold text-danger" : ""}>{t("Оплата до")}<b className="font-data font-medium">{formatDate(order.due_date)}</b>
            {isOverdue ? ` · просрочка ${overdueDays} дн.` : ""}
          </span>
        ) : null}
      </div>

      {/* Expanded items */}
      {isExpanded && order.order_items && order.order_items.length > 0 ? (
        <div className="mt-3 border-t border-black/5 pt-3">
          <OrderItemsList items={order.order_items} />
        </div>
      ) : null}

      {/* Revision note */}
      {order.revision_note ? (
        <p className="mt-3 rounded-md bg-accent-50 px-4 py-2 text-sm font-semibold text-burgundy">
          {order.revision_note}
        </p>
      ) : null}

      {/* Actions footer */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-black/10 pt-3">
        {canAcceptRevision ? (
          <button
            type="button"
            disabled={actionStatus === "loading"}
            className="rounded-full bg-espresso px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-espresso/90 disabled:opacity-50"
            onClick={() => void sendClientAction("accept_revision")}
          >{t("Принять изменения")}</button>
        ) : null}
        {canAcceptRevision ? (
          <button
            type="button"
            disabled={actionStatus === "loading"}
            className="rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold text-dark transition hover:bg-black/5 disabled:opacity-50"
            onClick={() => {
              const comment = window.prompt("Что нужно изменить в заявке?");
              if (comment?.trim()) void sendClientAction("request_change", comment);
            }}
          >{t("Изменить")}</button>
        ) : null}
        {order.payment_url ? (
          <a
            href={order.payment_url}
            className="rounded-full bg-coral px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-coral-hover"
          >
            Оплатить {formatCurrency(order.total_amount)}
          </a>
        ) : null}
        {showDocs ? (
          <>
            <Link href={`/documents/invoice/${order.id}`} className="rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold text-dark transition hover:bg-black/5">{t("Счет PDF")}</Link>
            <Link href={`/documents/nakl/${order.id}`} className="rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold text-dark transition hover:bg-black/5">{t("Накладная PDF")}</Link>
          </>
        ) : null}
        <button
          type="button"
          disabled={reorderingId === order.id}
          onClick={() => void reorder(order.id)}
          className="rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold text-dark transition hover:bg-black/5 disabled:opacity-50"
        >{reorderingId === order.id ? t("Добавляем…") : t("Повторить")}</button>
        {canCancel ? (
          <button
            type="button"
            disabled={actionStatus === "loading"}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-black/5 disabled:opacity-50"
            onClick={() => {
              const comment = window.prompt("Причина отмены");
              void sendClientAction("cancel", comment ?? "");
            }}
          >{t("Отменить")}</button>
        ) : null}
        {actionStatus === "error" ? (
          <span className="text-xs font-semibold text-danger">{t("Ошибка, попробуйте снова")}</span>
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
    <section className="mt-6 rounded-xl bg-white p-6 shadow-xs">
      <p className="text-xs font-bold uppercase tracking-[.06em] text-raspberry">{t("Рекомендуем")}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-dark">{t("Популярное у клиентов")}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-md bg-cream p-3"
          >
            <div className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-white">
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
    <div className="rounded-xl bg-white p-5 shadow-xs">
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
      <span className="ml-auto font-data font-semibold text-dark">{value}</span>
    </div>
  );
}

function ConditionsBox({ state }: { state: CreditState }) {
  const t = useT();
  return (
    <SidebarBox title={t("Условия")}>
      <KvRow label={t("Лимит")} value={formatCurrency(state.limit)} />
      <KvRow label={t("Статус")} value={t(creditStatusLabels[state.status])} />
      {state.nextDueDate ? (
        <KvRow label={t("Ближайший платёж")} value={formatDate(state.nextDueDate)} />
      ) : null}
      <button
        type="button"
        className="mt-3 w-full rounded-full border border-dashed border-black/20 py-2 text-xs font-semibold text-muted transition hover:border-coral hover:text-coral"
      >{t("Запросить увеличение лимита")}</button>
    </SidebarBox>
  );
}

function RecentOrdersBox({ orders }: { orders: ClientOrderSummary[] }) {
  const t = useT();
  const { reorder, reorderingId } = useReorder();
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
          <button
            type="button"
            disabled={reorderingId === order.id}
            onClick={() => void reorder(order.id)}
            className="rounded-full bg-espresso px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-espresso/90 disabled:opacity-50"
          >{reorderingId === order.id ? t("…") : t("В лист")}</button>
        </div>
      ))}
      <Link
        href="/catalog"
        className="mt-3 block w-full rounded-full border border-dashed border-black/20 py-2 text-center text-xs font-semibold text-muted transition hover:border-coral hover:text-coral"
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

function VerifyPhoneBanner({ phone, onVerified }: { phone: string; onVerified: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || seconds <= 0) return;
    const id = window.setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [open, seconds]);

  async function requestCode() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile/verify-phone/request", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("Не удалось отправить код"));
        return;
      }
      setOpen(true);
      setSeconds(120);
      setCode("");
    } catch {
      setError(t("Ошибка сети"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) {
      setError(t("Введите 6-значный код"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile/verify-phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("Неверный код"));
        return;
      }
      onVerified();
    } catch {
      setError(t("Ошибка сети"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-coral/20 bg-accent-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-burgundy">{t("Подтвердите номер WhatsApp")}</p>
          <p className="mt-0.5 text-xs font-semibold text-accent-700/80">
            {t("Подтвердите ")}<b>{phone}</b>{t(" — на него приходят счёт и документы. Пришлём код в WhatsApp.")}
          </p>
        </div>
        {!open ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestCode()}
            className="shrink-0 rounded-full border border-coral bg-white px-4 py-2 text-xs font-bold text-coral transition hover:bg-coral-light disabled:opacity-50"
          >
            {busy ? t("Отправляем...") : t("Подтвердить номер")}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-coral/15 pt-3">
          <Input
            className="w-32 text-center font-data text-lg tracking-[.3em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmCode();
              }
            }}
            placeholder="000000"
            autoFocus
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={() => void confirmCode()}
            className="rounded-full bg-coral px-4 py-2 text-xs font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
          >
            {t("Готово")}
          </button>
          <button
            type="button"
            disabled={busy || seconds > 90}
            onClick={() => void requestCode()}
            className="rounded-full px-3 py-2 text-xs font-semibold text-burgundy transition hover:bg-coral-light disabled:opacity-40"
          >
            {seconds > 0 ? t("Ещё раз (${time})", { time: formatMmss(seconds) }) : t("Отправить снова")}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-bold text-burgundy">{error}</p> : null}
    </div>
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
  // Момент захода фиксируем один раз (граница недели акции) — без Date.now() в рендере.
  const [nowMs] = useState(() => Date.now());
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

  const initials = (session.companyName || session.email || "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="mx-auto max-w-6xl">
      {/* Cabinet grid: [340px, 1fr] */}
      <div className="grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">
        {/* Left sidebar column */}
        <aside className="space-y-4">
          {/* Client hero card — espresso gradient */}
          <div
            className="rounded-2xl p-6 text-white shadow-md"
            style={{ background: "linear-gradient(150deg, var(--color-espresso), color-mix(in srgb, var(--color-espresso) 78%, black))" }}
          >
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10 font-display text-lg font-semibold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold leading-tight">
                  {session.companyName || "Кабинет партнёра"}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-white/60">{session.email}</p>
              </div>
            </div>

            {creditState ? (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-md bg-white/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-white/60">{t("Доступно")}</p>
                  <p className="mt-1 font-data text-base font-semibold leading-none">{formatCurrency(creditState.available)}</p>
                </div>
                <div className="rounded-md bg-white/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-white/60">{t("Лимит")}</p>
                  <p className="mt-1 font-data text-base font-semibold leading-none">{formatCurrency(creditState.limit)}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/catalog" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-espresso transition hover:bg-white/90">{t("В каталог")}</Link>
              <Link href="/cart" className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">{t("Корзина")}</Link>
              <button type="button" onClick={onLogout} className="rounded-full px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10">{t("Выйти")}</button>
            </div>
          </div>

          {/* Плашка: подтвердите второй способ (номер WhatsApp) */}
          {!session.phoneVerified && session.phone ? (
            <VerifyPhoneBanner
              phone={session.phone}
              onVerified={() => onUpdate({ ...session, phoneVerified: true })}
            />
          ) : null}

          {creditState ? <ConditionsBox state={creditState} /> : null}
          <RecentOrdersBox orders={orders} />
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
                <p className="rounded-md border border-black/10 bg-cream px-3 py-2 text-xs font-medium text-muted">
                  {session.email}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">WhatsApp</p>
                <p className="rounded-md border border-black/10 bg-cream px-3 py-2 text-xs font-medium text-muted">
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
                  className="rounded-full bg-espresso px-4 py-2 text-xs font-semibold text-white transition hover:bg-espresso/90"
                >{t("Сохранить")}</button>
                {saved ? <span className="text-xs font-semibold text-coral">{t("Сохранено")}</span> : null}
              </div>
            </div>
          </SidebarBox>
        </aside>

        {/* Right main column */}
        <div className="space-y-5">
          {/* Credit block */}
          {creditState ? (
            <CreditBlock state={creditState} />
          ) : null}

          {/* Промо «5 десертов» — прогресс считается по заказам текущей недели (0, если заказов нет) */}
          <HomeReward collected={weeklyPromoCollected(orders, nowMs)} />

          {/* Orders */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-black/10 pb-2">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[.05em] text-dark">{t("Заказы")}</h2>
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
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-white shadow-xs" />
                ))}
              </div>
            ) : ordersError ? (
              <div className="rounded-xl bg-accent-50 p-5 shadow-xs">
                <p className="text-sm font-semibold text-burgundy">{ordersError}</p>
              </div>
            ) : visibleOrders.length > 0 ? (
              <div className="space-y-2">
                {visibleOrders.map((order) => (
                  <ClientOrderCard key={order.id} order={order} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black/20 bg-white p-8 text-center shadow-xs">
                <p className="font-display text-lg font-semibold text-dark">{t("Заказов пока нет")}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("История подтягивается по email и телефону. Если заказ оформлялся на другой контакт — обратитесь к менеджеру.")}</p>
                <Link href="/catalog" className="mt-4 inline-block rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso/90">{t("Открыть каталог")}</Link>
              </div>
            )}
          </div>

          <PopularProductsSection products={popularProducts} />
        </div>
      </div>
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
            phoneVerified: clientData.phoneVerified ?? false,
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
          <div className="h-72 animate-pulse rounded-2xl bg-white shadow-md" />
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
