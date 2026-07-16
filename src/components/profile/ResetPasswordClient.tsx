"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const emptySubscribe = () => () => {};

export function ResetPasswordClient() {
  const [phase, setPhase] = useState<"form" | "saving" | "done">("form");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState("");

  // Supabase после клика по ссылке из письма редиректит сюда с токеном
  // в hash-фрагменте (#access_token=...&type=recovery) — он есть только на клиенте
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const accessToken = useMemo(() => {
    if (!isMounted) {
      return "";
    }

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("access_token") ?? "";
    const type = params.get("type") ?? "";

    return token && (type === "recovery" || type === "signup" || type === "") ? token : "";
  }, [isMounted]);

  const step: "checking" | "invalid" | "form" | "saving" | "done" = !isMounted
    ? "checking"
    : !accessToken
      ? "invalid"
      : phase;

  async function handleSave() {
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов");
      return;
    }

    if (password !== passwordRepeat) {
      setError("Пароли не совпадают");
      return;
    }

    if (!supabaseUrl || !anonKey) {
      setError("Сервис недоступен. Попробуйте позже.");
      return;
    }

    setError("");
    setPhase("saving");

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { msg?: string };
        setError(data.msg ?? "Не удалось обновить пароль. Запросите сброс ещё раз.");
        setPhase("form");
        return;
      }

      setPhase("done");
    } catch {
      setError("Не удалось обновить пароль. Проверьте соединение");
      setPhase("form");
    }
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      <section className="mx-auto max-w-md">
        <p className="text-sm font-bold uppercase text-raspberry">Профиль</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Новый пароль
        </h1>

        <div className="mt-8 rounded-card bg-white p-6 shadow-sm">
          {step === "checking" ? (
            <p className="text-sm font-semibold text-muted">Проверяем ссылку...</p>
          ) : step === "invalid" ? (
            <>
              <p className="text-sm font-semibold leading-6 text-dark/80">
                Ссылка недействительна или устарела. Запросите сброс пароля ещё раз на странице входа.
              </p>
              <Link
                href="/profile"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-btn border border-coral bg-coral px-5 text-sm font-bold text-white transition hover:bg-coral-hover"
              >
                К странице входа
              </Link>
            </>
          ) : step === "done" ? (
            <>
              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-sm font-bold text-green-700">Пароль обновлён</p>
                <p className="mt-1 text-sm font-semibold text-green-600/80">
                  Теперь войдите с новым паролем.
                </p>
              </div>
              <Link
                href="/profile"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-btn border border-coral bg-coral px-5 text-sm font-bold text-white transition hover:bg-coral-hover"
              >
                Войти
              </Link>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-bold text-dark">Новый пароль</span>
                  <Input
                    className="mt-2"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    placeholder="Минимум 8 символов"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-dark">Повторите пароль</span>
                  <Input
                    className="mt-2"
                    type="password"
                    value={passwordRepeat}
                    onChange={(e) => setPasswordRepeat(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSave();
                      }
                    }}
                    placeholder="••••••••"
                  />
                </label>
              </div>
              {error ? <p className="mt-3 text-sm font-bold text-burgundy">{error}</p> : null}
              <Button
                type="button"
                disabled={step === "saving"}
                className="mt-5 w-full"
                onClick={() => void handleSave()}
              >
                {step === "saving" ? "Сохраняем..." : "Сохранить пароль"}
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
