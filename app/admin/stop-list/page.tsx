import type { Metadata } from "next";
import { clearStopListItemAction } from "@/app/admin/stop-list/actions";
import { Badge } from "@/src/components/ui/Badge";
import { fetchProductStopEvents } from "@/src/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Стоп-лист | Админка DC Bakery",
};

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-KZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminStopListPage() {
  const [activeEvents, events] = await Promise.all([
    fetchProductStopEvents({ activeOnly: true }),
    fetchProductStopEvents(),
  ]);

  return (
    <div>
      <div className="rounded-card bg-white p-8 shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        <p className="text-sm font-black uppercase text-raspberry">Операции</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Стоп-лист</h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-muted">
          Позиции в активном стоп-листе скрываются с сайта и WhatsApp-каталога.
          Менеджер может добавить стоп через WhatsApp: “Наполеон на стопе”.
        </p>
      </div>

      <section className="mt-6 rounded-card bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-muted">Сейчас на стопе</p>
            <p className="mt-2 text-3xl font-black">{activeEvents.length}</p>
          </div>
          <Badge variant={activeEvents.length > 0 ? "burgundy" : "coral"}>
            {activeEvents.length > 0 ? "Есть стоп" : "Чисто"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3">
          {activeEvents.length > 0 ? (
            activeEvents.map((event) => (
              <div
                className="grid gap-3 rounded-card bg-cream p-4 lg:grid-cols-[1fr_auto]"
                key={event.id}
              >
                <div>
                  <p className="text-xl font-black text-dark">{event.product_name}</p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    С {formatDate(event.started_at)}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                </div>
                <form action={clearStopListItemAction}>
                  <input name="product_id" type="hidden" value={event.product_id} />
                  <button
                    className="min-h-10 rounded-btn bg-coral px-4 py-2 text-sm font-black text-white transition hover:bg-coral-hover"
                    type="submit"
                  >
                    Снять стоп
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="rounded-card bg-cream p-4 text-sm font-semibold text-muted">
              Активных стоп-позиций нет.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-card bg-white shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        <div className="border-b border-black/10 p-5">
          <p className="text-xl font-black">История стоп-листа</p>
        </div>
        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full border-collapse text-left text-sm font-semibold">
              <thead className="bg-coral-light text-xs font-black uppercase text-burgundy">
                <tr>
                  <th className="px-5 py-4">Товар</th>
                  <th className="px-5 py-4">Старт</th>
                  <th className="px-5 py-4">Снят</th>
                  <th className="px-5 py-4">Источник</th>
                  <th className="px-5 py-4">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {events.map((event) => (
                  <tr key={event.id} className="transition hover:bg-cream">
                    <td className="px-5 py-4 font-black">{event.product_name}</td>
                    <td className="px-5 py-4">{formatDate(event.started_at)}</td>
                    <td className="px-5 py-4">{formatDate(event.ended_at)}</td>
                    <td className="px-5 py-4">{event.source ?? "admin"}</td>
                    <td className="px-5 py-4 text-muted">{event.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm font-semibold text-muted">История пока пустая.</p>
        )}
      </section>
    </div>
  );
}
