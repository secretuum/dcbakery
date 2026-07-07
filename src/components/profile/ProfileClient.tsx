"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { orderStatusLabels, paymentStatusLabels } from "@/src/lib/order-status";
import { useCart } from "@/src/contexts/CartContext";
import type { ClientOrderSummary, OrderItemSummary, Product } from "@/src/types";

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
  accountant_phone?: string;
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

function formatDate(value?: string | null) {
  if (!value) {
    return "не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(new Date(value));
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
      accountant_phone: parsedSession.accountant_phone ?? "",
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
        <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          Вход в кабинет DC Bakery
        </h1>
        <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-muted">
          Одна форма для клиента и команды. Если введены данные админа из Supabase, откроется
          админ-профиль. Остальные данные пока открывают MVP-кабинет клиента без подключения базы.
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

      <form
        onSubmit={handleSubmit}
        className="rounded-card bg-white p-6 shadow-sm sm:p-8"
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

function ClientOrderCard({ order, clientPhone }: { order: ClientOrderSummary; clientPhone: string }) {
  const orderStatus = orderStatusLabels[order.status] ?? order.status;
  const paymentStatus = order.payment_status
    ? paymentStatusLabels[order.payment_status]
    : "не указано";
  const [actionStatus, setActionStatus] = useState<"error" | "idle" | "loading">("idle");
  const [isExpanded, setIsExpanded] = useState(false);
  const canCancel =
    order.payment_status !== "paid" &&
    !["paid", "completed", "canceled", "cancelled"].includes(order.status);
  const canAcceptRevision = order.status === "change_proposed";

  async function sendClientAction(
    action: "accept_revision" | "cancel" | "request_change",
    comment?: string,
  ) {
    setActionStatus("loading");

    const response = await fetch(`/api/orders/${order.id}/client-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-phone": clientPhone,
      },
      body: JSON.stringify({ action, comment }),
    });

    if (!response.ok) {
      setActionStatus("error");
      return;
    }

    window.location.reload();
  }

  return (
    <article className="rounded-card bg-white p-5 shadow-sm">
      <button
        type="button"
        className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div>
          <p className="text-xs font-black uppercase text-raspberry">{order.order_number}</p>
          <h3 className="mt-2 text-xl font-black tracking-tight">{order.company_name}</h3>
          <p className="mt-2 text-sm font-semibold text-muted">
            Создан: {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xl font-black text-coral">{formatCurrency(order.total_amount)}</p>
          <span className="text-xs text-muted">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {isExpanded && order.order_items && order.order_items.length > 0 ? (
        <OrderItemsList items={order.order_items} />
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-btn bg-cream px-4 py-3">
          <p className="text-xs font-black uppercase text-muted">Заявка</p>
          <p className="mt-1 text-sm font-black text-dark">{orderStatus}</p>
        </div>
        <div className="rounded-btn bg-cream px-4 py-3">
          <p className="text-xs font-black uppercase text-muted">Оплата</p>
          <p className="mt-1 text-sm font-black text-dark">{paymentStatus}</p>
        </div>
        <div className="rounded-btn bg-cream px-4 py-3">
          <p className="text-xs font-black uppercase text-muted">Доставка</p>
          <p className="mt-1 text-sm font-black text-dark">{formatDate(order.delivery_date)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {canAcceptRevision ? (
          <Button
            type="button"
            className="min-h-10 px-4 py-2"
            disabled={actionStatus === "loading"}
            onClick={() => sendClientAction("accept_revision")}
          >
            Принять изменения
          </Button>
        ) : null}
        {canAcceptRevision ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-10 px-4 py-2"
            disabled={actionStatus === "loading"}
            onClick={() => {
              const comment = window.prompt("Что нужно изменить в заявке?");

              if (comment?.trim()) {
                void sendClientAction("request_change", comment);
              }
            }}
          >
            Изменить
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-10 px-4 py-2 text-burgundy"
            disabled={actionStatus === "loading"}
            onClick={() => {
              const comment = window.prompt("Причина отмены");
              void sendClientAction("cancel", comment ?? "");
            }}
          >
            Отменить
          </Button>
        ) : null}
        {order.payment_url ? (
          <Button href={order.payment_url} className="min-h-10 px-4 py-2">
            Оплата
          </Button>
        ) : null}
        <Button href="/catalog" variant="outline" className="min-h-10 px-4 py-2">
          Повторить закупку
        </Button>
      </div>
      {order.revision_note ? (
        <p className="mt-3 rounded-btn bg-coral-light px-4 py-3 text-sm font-bold text-burgundy">
          {order.revision_note}
        </p>
      ) : null}
      {actionStatus === "error" ? (
        <p className="mt-3 text-sm font-bold text-red-600">Не удалось выполнить действие</p>
      ) : null}
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
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex flex-col justify-between rounded-xl border border-black/10 bg-white p-4"
          >
            <div>
              <p className="text-sm font-black leading-tight text-dark">{product.name}</p>
              <p className="mt-2 text-lg font-bold text-dark">
                {product.price > 0 ? formatCurrency(product.price) : "Цена уточняется"}
              </p>
            </div>
            <button
              type="button"
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-btn bg-coral px-4 py-2 text-sm font-black text-white transition hover:bg-coral-hover"
              onClick={() => add(product, product.min_qty)}
            >
              + В корзину
            </button>
          </div>
        ))}
      </div>
    </section>
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
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orders, setOrders] = useState<ClientOrderSummary[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [phone, setPhone] = useState(session.phone);
  const [saved, setSaved] = useState(false);

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

  const activeOrders = orders.filter(
    (order) => !["completed", "canceled", "cancelled"].includes(order.status),
  ).length;
  const paidAmount = orders
    .filter((order) => order.status === "paid" || order.payment_status === "paid")
    .reduce((sum, order) => sum + order.total_amount, 0);

  function handleSave() {
    const nextSession: ClientSession = {
      ...session,
      companyName,
      phone,
      accountant_phone: accountantPhone,
    };

    writeClientSession(nextSession);
    onUpdate(nextSession);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 rounded-card bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div>
          <p className="text-sm font-black uppercase text-raspberry">Клиентский профиль</p>
          <h1 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-4xl">
            {session.companyName || "Кабинет партнера"}
          </h1>
          <p className="mt-3 break-all text-sm font-semibold text-muted">{session.email}</p>
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Всего заказов"
          value={isLoadingOrders ? "..." : String(orders.length)}
          icon={
            <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <MetricCard
          label="Активные заявки"
          value={isLoadingOrders ? "..." : String(activeOrders)}
          icon={
            <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          label="Оплачено"
          value={formatCurrency(paidAmount)}
          icon={
            <svg className="h-5 w-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <PopularProductsSection products={popularProducts} />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-card bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-raspberry">История</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Заказы</h2>
            </div>
            <span className="w-fit rounded-badge bg-coral-light px-4 py-2 text-xs font-black text-burgundy">
              MVP по email/телефону
            </span>
          </div>
          {isLoadingOrders ? (
            <div className="mt-6 rounded-card bg-cream p-6">
              <div className="h-28 animate-pulse rounded-card bg-white" />
            </div>
          ) : ordersError ? (
            <div className="mt-6 rounded-card border border-coral/30 bg-coral-light p-6">
              <h3 className="text-xl font-black tracking-tight">Не удалось загрузить заказы</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-burgundy/75">
                {ordersError}
              </p>
            </div>
          ) : orders.length > 0 ? (
            <div className="mt-6 space-y-4">
              {orders.map((order) => (
                <ClientOrderCard key={order.id} order={order} clientPhone={session.phone} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-card border border-dashed border-coral/40 bg-cream p-6">
              <h3 className="text-xl font-black tracking-tight">Заказы пока не найдены</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                История подтягивается по email и телефону из профиля. Если заказ оформлялся на другой
                контакт, обновите настройки профиля или соберите новую заявку.
              </p>
              <Button href="/catalog" className="mt-5">
                Собрать первый заказ
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-card bg-white p-6 shadow-sm">
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
            <label className="block">
              <span className="text-sm font-black text-dark">Телефон бухгалтера</span>
              <Input
                className="mt-2"
                inputMode="tel"
                value={accountantPhone}
                onChange={(event) => setAccountantPhone(event.currentTarget.value)}
                placeholder="+7 (___) ___-__-__"
              />
              <p className="mt-1 text-xs font-semibold text-muted">WhatsApp для получения счетов</p>
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

export function ProfileClient({ popularProducts = [] }: { popularProducts?: Product[] }) {
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
          <div className="h-72 animate-pulse rounded-card bg-white shadow-sm" />
        </section>
      ) : session?.role === "admin" ? (
        <AdminDashboard session={session} onLogout={handleLogout} />
      ) : session?.role === "client" ? (
        <ClientDashboard session={session} onLogout={handleLogout} onUpdate={setSession} popularProducts={popularProducts} />
      ) : (
        <LoginPanel onLogin={setSession} />
      )}
    </main>
  );
}
