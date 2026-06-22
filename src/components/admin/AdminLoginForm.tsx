"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/admin/orders";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError("Неверный email или пароль");
        return;
      }

      router.push(nextPath.startsWith("/admin") ? nextPath : "/admin/orders");
      router.refresh();
    } catch {
      setError("Не удалось войти, попробуйте снова");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card bg-white p-6 shadow-[0_24px_80px_rgba(120,51,38,0.12)] sm:p-8"
    >
      <div>
        <p className="text-sm font-black uppercase text-raspberry">Админка</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Вход в DC Bakery</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          Используйте email и пароль пользователя, созданного в Supabase Authentication.
        </p>
      </div>

      <div className="mt-7 space-y-5">
        <label className="block">
          <span className="text-sm font-black text-dark">Email</span>
          <Input
            className="mt-2"
            inputMode="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="admin@example.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-black text-dark">Пароль</span>
          <Input
            className="mt-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            placeholder="••••••••"
          />
        </label>
      </div>

      {error ? <p className="mt-4 text-sm font-bold text-burgundy">{error}</p> : null}

      <Button type="submit" disabled={isSubmitting} className="mt-7 w-full">
        {isSubmitting ? "Входим..." : "Войти"}
      </Button>
    </form>
  );
}
