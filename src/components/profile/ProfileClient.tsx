"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";

const PROFILE_STORAGE_KEY = "dc_bakery_client_profile";

type AdminSession = {
  email: string;
  role: "admin";
};

type ClientSession = {
  companyName: string;
  createdAt: string;
  email: string;
  phone: string;
  role: "client";
};

type ProfileSession = AdminSession | ClientSession;

type ProfileSessionResponse = {
  authenticated?: boolean;
  email?: string;
  role?: "admin" | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-KZ", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "KZT",
  }).format(value);
}

function readClientSession(): ClientSession | null {
  try {
    const rawSession = window.localStorage.getItem(PROFILE_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession) as Partial<ClientSession>;

    if (parsedSession.role !== "client" || !parsedSession.email) {
      return null;
    }

    return {
      companyName: parsedSession.companyName ?? "",
      createdAt: parsedSession.createdAt ?? new Date().toISOString(),
      email: parsedSession.email,
      phone: parsedSession.phone ?? "",
      role: "client",
    };
  } catch {
    return null;
  }
}

function writeClientSession(session: ClientSession) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(session));
}

function removeClientSession() {
  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
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
  tone = "light",
}: {
  label: string;
  value: string;
  tone?: "light" | "coral";
}) {
  return (
    <div
      className={
        tone === "coral"
          ? "rounded-card bg-coral p-5 text-white shadow-[0_18px_48px_rgba(244,123,111,0.22)]"
          : "rounded-card bg-white p-5 shadow-[0_18px_48px_rgba(120,51,38,0.08)]"
      }
    >
      <p className={tone === "coral" ? "text-xs font-black uppercase text-white/80" : "text-xs font-black uppercase text-muted"}>
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function LoginPanel({ onLogin }: { onLogin: (session: ProfileSession) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  function handleClientLogin() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Введите email для клиентского профиля");
      return;
    }

    const clientSession: ClientSession = {
      companyName: normalizedEmail.split("@")[0] ?? "",
      createdAt: new Date().toISOString(),
      email: normalizedEmail,
      phone: "",
      role: "client",
    };

    writeClientSession(clientSession);
    onLogin(clientSession);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Введите email и пароль");
      return;
    }

    setIsSubmitting(true);

    try {
      const adminResponse = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      if (adminResponse.ok) {
        removeClientSession();
        onLogin({
          email: normalizedEmail,
          role: "admin",
        });
        return;
      }

      if (adminResponse.status !== 401) {
        setError("Не удалось проверить вход. Попробуйте еще раз");
        return;
      }

      setError(
        "Админ-вход не прошел. Проверьте email, пароль и что пользователь создан в Supabase Authentication.",
      );
    } catch {
      setError("Не удалось войти. Проверьте соединение и попробуйте снова");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
      <div>
        <p className="text-sm font-black uppercase text-raspberry">Профиль</p>
        <h1 className="mt-3 max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          Вход в кабинет DC Bakery
        </h1>
        <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-muted">
          Одна форма для клиента и команды. Если введены данные админа из Supabase, откроется
          админ-профиль. Остальные данные пока открывают MVP-кабинет клиента без подключения базы.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-card bg-white p-5 shadow-[0_18px_48px_rgba(120,51,38,0.08)]">
            <div className="flex items-center gap-3 text-raspberry">
              <ClientIcon />
              <p className="text-sm font-black">Клиент</p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">
              История заказов, повтор закупки, настройки компании и документы.
            </p>
          </div>
          <div className="rounded-card bg-coral-light p-5 shadow-[0_18px_48px_rgba(120,51,38,0.08)]">
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

      <form
        onSubmit={handleSubmit}
        className="rounded-card bg-white p-6 shadow-[0_24px_80px_rgba(120,51,38,0.12)] sm:p-8"
      >
        <div>
          <p className="text-sm font-black uppercase text-raspberry">Войти</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight">Email и пароль</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            Для админа используйте пользователя из Supabase Authentication.
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
              placeholder="company@example.com"
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
          {isSubmitting ? "Проверяем..." : "Войти в профиль"}
        </Button>
        <Button
          type="button"
          disabled={isSubmitting}
          variant="outline"
          className="mt-3 w-full"
          onClick={handleClientLogin}
        >
          Открыть клиентский профиль
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
  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 rounded-card bg-dark p-6 text-white shadow-[0_24px_80px_rgba(28,28,28,0.18)] lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div>
          <p className="text-sm font-black uppercase text-coral">Админ-профиль</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">DC Bakery Manager</h1>
          <p className="mt-3 text-sm font-semibold text-white/70">{session.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/admin/orders" className="bg-white text-dark hover:bg-coral-light">
            Заказы
          </Button>
          <Button href="/admin/products" variant="outline" className="border-white text-white hover:bg-white/10">
            Товары
          </Button>
          <Button type="button" variant="ghost" className="text-white hover:bg-white/10" onClick={onLogout}>
            Выйти
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Заявки" value="Админка" tone="coral" />
        <MetricCard label="Оплата" value="Контроль" />
        <MetricCard label="Каталог" value="Товары" />
        <MetricCard label="Каналы" value="WA/TG" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Link
          href="/admin/orders"
          className="rounded-card bg-white p-6 shadow-[0_18px_48px_rgba(120,51,38,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(120,51,38,0.12)]"
        >
          <p className="text-xs font-black uppercase text-raspberry">Операции</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">Заказы</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            Новые заявки, подтверждение, ссылка оплаты и статусы доставки.
          </p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-card bg-white p-6 shadow-[0_18px_48px_rgba(120,51,38,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(120,51,38,0.12)]"
        >
          <p className="text-xs font-black uppercase text-raspberry">Каталог</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">Товары</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            Наличие, цены, активность товаров и подготовка к единой базе остатков.
          </p>
        </Link>
        <Link
          href="/admin/settings"
          className="rounded-card bg-white p-6 shadow-[0_18px_48px_rgba(120,51,38,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(120,51,38,0.12)]"
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

function ClientDashboard({
  session,
  onLogout,
  onUpdate,
}: {
  session: ClientSession;
  onLogout: () => void;
  onUpdate: (session: ClientSession) => void;
}) {
  const [companyName, setCompanyName] = useState(session.companyName);
  const [phone, setPhone] = useState(session.phone);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const nextSession: ClientSession = {
      ...session,
      companyName,
      phone,
    };

    writeClientSession(nextSession);
    onUpdate(nextSession);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 rounded-card bg-white p-6 shadow-[0_24px_80px_rgba(120,51,38,0.12)] lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div>
          <p className="text-sm font-black uppercase text-raspberry">Клиентский профиль</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            {session.companyName || "Кабинет партнера"}
          </h1>
          <p className="mt-3 text-sm font-semibold text-muted">{session.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/catalog">В каталог</Button>
          <Button href="/cart" variant="outline">
            Корзина
          </Button>
          <Button type="button" variant="ghost" onClick={onLogout}>
            Выйти
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="История заказов" value="0" tone="coral" />
        <MetricCard label="Минимальный заказ" value={formatCurrency(MIN_ORDER_AMOUNT)} />
        <MetricCard label="Повтор закупки" value="Скоро" />
        <MetricCard label="Документы" value="Скоро" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-card bg-white p-6 shadow-[0_18px_48px_rgba(120,51,38,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-raspberry">История</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Заказы</h2>
            </div>
            <span className="w-fit rounded-badge bg-coral-light px-4 py-2 text-xs font-black text-burgundy">
              MVP без базы клиентов
            </span>
          </div>
          <div className="mt-6 rounded-card border border-dashed border-coral/40 bg-cream p-6">
            <h3 className="text-xl font-black tracking-tight">История заказов появится здесь</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-muted">
              После подключения клиентских аккаунтов сюда попадут прошлые заявки, повтор заказа,
              статусы оплаты и документы.
            </p>
            <Button href="/catalog" className="mt-5">
              Собрать первый заказ
            </Button>
          </div>
        </section>

        <section className="rounded-card bg-white p-6 shadow-[0_18px_48px_rgba(120,51,38,0.08)]">
          <p className="text-xs font-black uppercase text-raspberry">Настройки</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Профиль компании</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-black text-dark">Компания / заведение</span>
              <Input
                className="mt-2"
                value={companyName}
                onChange={(event) => setCompanyName(event.currentTarget.value)}
                placeholder="Название компании"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-dark">Телефон</span>
              <Input
                className="mt-2"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.currentTarget.value)}
                placeholder="+7 (___) ___-__-__"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleSave}>
              Сохранить
            </Button>
            {saved ? <span className="text-sm font-black text-raspberry">Сохранено</span> : null}
          </div>
        </section>
      </div>
    </section>
  );
}

export function ProfileClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<ProfileSession | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/profile/session", {
          cache: "no-store",
        });
        const adminSession = (await response.json()) as ProfileSessionResponse;

        if (isMounted && adminSession.authenticated && adminSession.role === "admin") {
          setSession({
            email: adminSession.email ?? "",
            role: "admin",
          });
          return;
        }
      } catch {
      }

      if (isMounted) {
        setSession(readClientSession());
        setIsLoading(false);
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
    removeClientSession();

    if (session?.role === "admin") {
      await fetch("/api/admin/logout", {
        method: "POST",
      }).catch(() => undefined);
      router.refresh();
    }

    setSession(null);
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-12 text-dark lg:px-8 lg:py-16">
      {isLoading ? (
        <section className="mx-auto max-w-6xl">
          <div className="h-72 animate-pulse rounded-card bg-white shadow-[0_24px_80px_rgba(120,51,38,0.10)]" />
        </section>
      ) : session?.role === "admin" ? (
        <AdminDashboard session={session} onLogout={handleLogout} />
      ) : session?.role === "client" ? (
        <ClientDashboard session={session} onLogout={handleLogout} onUpdate={setSession} />
      ) : (
        <LoginPanel onLogin={setSession} />
      )}
    </main>
  );
}
