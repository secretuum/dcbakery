"use client";

import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { isValidBin } from "@/src/lib/bin";
import { isValidKzMobile } from "@/src/lib/phone";
import { useT } from "@/src/i18n/client";

// Гейт оформления: заказ только с подтверждённым аккаунтом. Данные компании/контакта
// уже собраны в чекауте — здесь добираем недостающее (email/БИН/пароль) и подтверждаем
// номер WhatsApp-кодом (те же эндпоинты, что и на /profile). После успеха заказ уходит.

type Prefill = { company: string; phone: string; email: string; name: string; bin: string };

type Props = {
  prefill: Prefill;
  onClose: () => void;
  /** Успешная авторизация. patch — добранные в гейте email/БИН, чтобы попали в заказ. */
  onAuthenticated: (patch?: { customer_email?: string; customer_bin?: string }) => void;
};

function formatMmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  return `${m}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function CheckoutAuthGate({ prefill, onClose, onAuthenticated }: Props) {
  const t = useT();
  const [mode, setMode] = useState<"register" | "login">("register");

  // Регистрация (email/БИН редактируемы — в чекауте они необязательны)
  const [email, setEmail] = useState(prefill.email);
  const [bin, setBin] = useState(prefill.bin);
  const [password, setPassword] = useState("");
  const [regStep, setRegStep] = useState<"form" | "submitting" | "otp" | "verifying">("form");
  const [otpCode, setOtpCode] = useState("");
  const [otpSeconds, setOtpSeconds] = useState(0);
  const [resending, setResending] = useState(false);

  // Вход
  const [login, setLogin] = useState(prefill.email || prefill.phone || "");
  const [loginPassword, setLoginPassword] = useState("");
  const [signing, setSigning] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (regStep !== "otp") return;
    const id = window.setInterval(() => setOtpSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [regStep]);

  async function handleRegister() {
    if (!email.includes("@")) {
      setError(t("Введите корректный email"));
      return;
    }
    if (!isValidKzMobile(prefill.phone)) {
      setError(t("Проверьте номер телефона в заказе"));
      return;
    }
    if (password.length < 8) {
      setError(t("Пароль должен быть не короче 8 символов"));
      return;
    }
    if (!prefill.company.trim()) {
      setError(t("Укажите название компании в заказе"));
      return;
    }
    if (!isValidBin(bin)) {
      setError(t("БИН/ИИН указан неверно — проверьте 12 цифр"));
      return;
    }

    setError("");
    setRegStep("submitting");

    try {
      const response = await fetch("/api/profile/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          phone: prefill.phone,
          password,
          companyName: prefill.company,
          customerBin: bin,
          customerName: prefill.name,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        needsOtp?: boolean;
        needsEmailConfirm?: boolean;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? t("Не удалось создать аккаунт"));
        setRegStep("form");
        return;
      }

      if (data.needsOtp) {
        setOtpCode("");
        setOtpSeconds(120);
        setRegStep("otp");
        return;
      }

      if (data.needsEmailConfirm) {
        setError(t("Подтвердите почту по ссылке из письма, затем войдите."));
        setMode("login");
        setRegStep("form");
        return;
      }

      onAuthenticated({ customer_email: email.trim().toLowerCase(), customer_bin: bin });
    } catch {
      setError(t("Ошибка сети. Попробуйте снова"));
      setRegStep("form");
    }
  }

  async function handleVerify() {
    const code = otpCode.replace(/\D/g, "");
    if (code.length !== 6) {
      setError(t("Введите 6-значный код из WhatsApp"));
      return;
    }

    setError("");
    setRegStep("verifying");

    try {
      const response = await fetch("/api/profile/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };

      if (!response.ok || !data.ok) {
        setError(data.error ?? t("Неверный код"));
        setRegStep("otp");
        return;
      }

      onAuthenticated({ customer_email: email.trim().toLowerCase(), customer_bin: bin });
    } catch {
      setError(t("Ошибка сети. Попробуйте снова"));
      setRegStep("otp");
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setError("");

    try {
      const response = await fetch("/api/profile/otp/resend", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };

      if (!response.ok || !data.ok) {
        setError(data.error ?? t("Не удалось отправить код"));
        return;
      }

      setOtpCode("");
      setOtpSeconds(120);
    } catch {
      setError(t("Не удалось отправить код"));
    } finally {
      setResending(false);
    }
  }

  async function handleLogin() {
    if (!login.trim() || !loginPassword) {
      setError(t("Введите логин и пароль"));
      return;
    }

    setError("");
    setSigning(true);

    try {
      const response = await fetch("/api/profile/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password: loginPassword }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        notRegistered?: boolean;
      };

      if (response.ok && data.notRegistered) {
        setError(t("Аккаунт не найден — зарегистрируйтесь."));
        setMode("register");
        return;
      }

      if (!response.ok || !data.ok) {
        setError(data.error ?? t("Не удалось войти"));
        return;
      }

      onAuthenticated();
    } catch {
      setError(t("Ошибка сети. Попробуйте снова"));
    } finally {
      setSigning(false);
    }
  }

  const isOtp = mode === "register" && (regStep === "otp" || regStep === "verifying");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight text-dark">
            {isOtp
              ? t("Код из WhatsApp")
              : mode === "login"
                ? t("Вход в кабинет")
                : t("Подтвердите аккаунт")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Закрыть")}
            className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-2xl leading-none text-muted transition hover:bg-black/5 hover:text-dark"
          >
            ×
          </button>
        </div>

        {isOtp ? (
          <>
            <p className="mt-3 text-[13.5px] leading-6 text-muted">
              {t("Мы отправили код на ")}<b className="font-semibold text-dark">{prefill.phone}</b>{t(". Введите 6 цифр — код действует 2 минуты.")}
            </p>
            <Input
              className="mt-4 text-center font-data text-2xl tracking-[.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleVerify();
                }
              }}
              placeholder="000000"
              autoFocus
            />
            {error ? <p className="mt-3 text-xs font-bold text-burgundy">{error}</p> : null}
            <p className="mt-2 text-xs font-semibold text-muted">
              {otpSeconds > 0
                ? t("Код действует ещё ${time}", { time: formatMmss(otpSeconds) })
                : t("Срок кода истёк — запросите новый.")}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                className="flex-1"
                disabled={regStep === "verifying" || otpCode.length !== 6}
                onClick={() => void handleVerify()}
              >
                {regStep === "verifying" ? t("Проверяем...") : t("Подтвердить и оформить")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={resending || otpSeconds > 90}
                onClick={() => void handleResend()}
              >
                {resending ? t("...") : t("Ещё раз")}
              </Button>
            </div>
          </>
        ) : mode === "login" ? (
          <>
            <p className="mt-3 text-[13.5px] leading-6 text-muted">{t("Войдите — и заказ оформится сразу.")}</p>
            <label className="mt-4 block">
              <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("Почта или номер телефона")}</span>
              <Input value={login} onChange={(e) => setLogin(e.currentTarget.value)} placeholder="company@example.com" />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("Пароль")}</span>
              <Input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleLogin();
                  }
                }}
                placeholder="••••••••"
              />
            </label>
            {error ? <p className="mt-3 text-xs font-bold text-burgundy">{error}</p> : null}
            <Button type="button" className="mt-5 w-full" disabled={signing} onClick={() => void handleLogin()}>
              {signing ? t("Входим...") : t("Войти и оформить")}
            </Button>
            <button
              type="button"
              className="mt-4 text-[13.5px] font-semibold text-muted underline-offset-2 transition hover:text-dark hover:underline"
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >{t("Нет аккаунта? Зарегистрироваться")}</button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[13.5px] leading-6 text-muted">
              {t("Заказы оформляются только с подтверждённым аккаунтом. Придумайте пароль — код подтверждения придёт в WhatsApp на ")}<b className="font-semibold text-dark">{prefill.phone}</b>.
            </p>
            <div className="mt-4 rounded-md bg-cream px-4 py-3 text-xs font-semibold text-muted">
              {t("Компания")}: <span className="text-dark">{prefill.company || "—"}</span>
              {prefill.name ? <span className="ml-2">· {prefill.name}</span> : null}
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-[13.5px] font-semibold text-dark">Email</span>
              <Input
                inputMode="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="company@example.com"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("БИН / ИИН")}</span>
              <Input
                inputMode="numeric"
                value={bin}
                onChange={(e) => setBin(e.currentTarget.value)}
                placeholder={t("12 цифр")}
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-[13.5px] font-semibold text-dark">{t("Пароль для кабинета")}</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleRegister();
                  }
                }}
                placeholder={t("Минимум 8 символов")}
              />
            </label>
            {error ? <p className="mt-3 text-xs font-bold text-burgundy">{error}</p> : null}
            <Button type="button" className="mt-5 w-full" disabled={regStep === "submitting"} onClick={() => void handleRegister()}>
              {regStep === "submitting" ? t("Отправляем код...") : t("Получить код в WhatsApp")}
            </Button>
            <button
              type="button"
              className="mt-4 text-[13.5px] font-semibold text-muted underline-offset-2 transition hover:text-dark hover:underline"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >{t("Уже есть аккаунт? Войти")}</button>
          </>
        )}
      </div>
    </div>
  );
}
