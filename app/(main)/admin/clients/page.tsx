import type { Metadata } from "next";
import Link from "next/link";
import { fetchWhatsAppClients } from "@/src/lib/whatsapp-client-store";
import { fetchAllClients } from "@/src/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Клиенты | Админка DC Bakery",
};

function optional(value?: string | null) {
  return value?.trim() ? value : "не указано";
}

function getClientHref(chatId: string) {
  return `/admin/clients/${encodeURIComponent(chatId)}`;
}

const creditDot: Record<string, string> = {
  active: "bg-green-500",
  prepay_only: "bg-amber-400",
  blocked: "bg-red-500",
};
const creditLabel: Record<string, string> = {
  active: "Активен",
  prepay_only: "Предоплата",
  blocked: "Блокирован",
};

export default async function AdminClientsPage() {
  const [clients, creditClients] = await Promise.all([
    fetchWhatsAppClients(),
    fetchAllClients(),
  ]);
  const creditByPhone = new Map(creditClients.map((c) => [c.phone, c]));

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Админка</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Клиенты</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Профили клиентов из WhatsApp: реквизиты, адреса и быстрый переход к истории заказов.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-black/10 bg-white">
        {clients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left">
              <thead className="bg-cream text-xs font-semibold uppercase tracking-[.06em] text-muted">
                <tr>
                  <th className="px-5 py-4">Компания</th>
                  <th className="px-5 py-4">Контакт</th>
                  <th className="px-5 py-4">WhatsApp</th>
                  <th className="px-5 py-4">БИН/ИП</th>
                  <th className="px-5 py-4">Адреса</th>
                  <th className="px-5 py-4">Кредит</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm font-semibold">
                {clients.map((client) => {
                  const credit = client.customerPhone
                    ? creditByPhone.get(client.customerPhone) ?? null
                    : null;
                  return (
                  <tr key={client.chatId} className="transition hover:bg-cream">
                    <td className="px-5 py-4">
                      <Link
                        href={getClientHref(client.chatId)}
                        className="font-bold text-coral hover:text-coral-hover"
                      >
                        {optional(client.companyName)}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-dark">{optional(client.customerName)}</p>
                      <p className="mt-1 text-xs text-muted">{optional(client.customerEmail)}</p>
                    </td>
                    <td className="px-5 py-4 text-muted">{optional(client.customerPhone)}</td>
                    <td className="px-5 py-4 text-muted">{optional(client.customerBin)}</td>
                    <td className="px-5 py-4 text-muted">
                      {client.addresses?.length
                        ? `${client.addresses.length} адрес(а)`
                        : optional(client.deliveryAddress)}
                    </td>
                    <td className="px-5 py-4">
                      {credit ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`size-2 rounded-full ${creditDot[credit.status] ?? "bg-muted"}`} />
                          <span className="text-xs font-semibold text-dark">
                            {creditLabel[credit.status] ?? credit.status}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-sm text-muted">
            Клиенты появятся после первого сохранения профиля из WhatsApp.
          </div>
        )}
      </div>
    </div>
  );
}
