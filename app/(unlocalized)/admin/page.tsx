import type { Metadata } from "next";
import Link from "next/link";
import { fetchAdminOrderStats } from "@/src/lib/orders/order-stats";
import { formatPrice } from "@/src/lib/format";

export const metadata: Metadata = { title: "Дашборд | Админка DC Bakery" };

function StatCard({
  label,
  value,
  hint,
  href,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  accent?: "coral" | "danger" | "muted";
}) {
  const valueColor =
    accent === "coral" ? "text-coral" : accent === "danger" ? "text-danger" : "text-dark";
  const inner = (
    <div className="rounded-card border border-black/10 bg-white p-5 transition hover:border-coral/40 hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminDashboardPage() {
  const stats = await fetchAdminOrderStats();

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Админка</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Дашборд</h1>

      {stats ? (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Выручка (оплачено)"
              value={formatPrice(stats.paid_revenue)}
              hint={`${stats.paid_count} оплаченных заказов`}
              accent="coral"
              href="/admin/orders?status=paid"
            />
            <StatCard
              label="Дебиторка (ждут оплаты)"
              value={formatPrice(stats.outstanding_amount)}
              hint={`${stats.outstanding_count} заказов в ожидании оплаты`}
              href="/admin/orders?status=confirmed_waiting_payment"
            />
            <StatCard
              label="Просрочка"
              value={formatPrice(stats.overdue_amount)}
              hint={`${stats.overdue_count} просроченных`}
              accent={stats.overdue_count > 0 ? "danger" : "muted"}
            />
            <StatCard
              label="Нужно подтвердить"
              value={String(stats.pending_count)}
              hint="новые заявки"
              href="/admin/orders?status=pending_manager_confirmation"
            />
            <StatCard
              label="В работе / доставка"
              value={String(stats.in_progress_count)}
              href="/admin/orders?status=in_progress"
            />
            <StatCard label="Всего заказов" value={String(stats.orders_total)} href="/admin/orders" />
          </div>
          <div className="mt-6">
            <Link
              href="/admin/orders"
              className="inline-flex items-center rounded-btn border border-dark bg-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-dark/90"
            >
              Все заказы →
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-7 rounded-card border border-black/10 bg-white p-8">
          <h2 className="font-display text-xl font-semibold">Статистика недоступна</h2>
          <p className="mt-2 text-sm text-muted">
            Не удалось получить агрегаты. Проверьте, что применена миграция
            <code className="mx-1 rounded bg-cream px-1.5 py-0.5 text-xs">202608030001</code>
            (функция <code className="rounded bg-cream px-1.5 py-0.5 text-xs">admin_order_stats</code>).
          </p>
          <Link
            href="/admin/orders"
            className="mt-5 inline-flex items-center rounded-btn border border-dark bg-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-dark/90"
          >
            Перейти к заказам →
          </Link>
        </div>
      )}
    </div>
  );
}
