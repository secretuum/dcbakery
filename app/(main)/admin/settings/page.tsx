import type { Metadata } from "next";
import { WhatsAppSettingControl } from "@/src/components/admin/WhatsAppSettingControl";
import { getCompanyDetails, hasCompleteCompanyDetails } from "@/src/lib/company-details";
import { getPaymentMode } from "@/src/lib/payments";
import { fetchAppSettings } from "@/src/lib/supabase/admin";

type SettingControl = {
  description: string;
  key: string;
  label: string;
};

export const metadata: Metadata = {
  title: "Настройки | Админка DC Bakery",
};

const settingControls: SettingControl[] = [
  {
    description: "Полностью выключает нашу обработку WhatsApp. Webhook продолжит отвечать и форвардить события второму боту.",
    key: "whatsapp_bot_enabled",
    label: "WhatsApp-система DC Bakery",
  },
  {
    description: "Выключает ответы клиентам: каталог, корзину и оформление заявок через личный чат клиента.",
    key: "whatsapp_customer_bot_enabled",
    label: "Клиентский WhatsApp-бот",
  },
  {
    description: "Выключает команды менеджера: подтверждение, оплата, отмена и изменение остатков из менеджерского чата.",
    key: "whatsapp_manager_commands_enabled",
    label: "Команды менеджера в WhatsApp",
  },
];

function isEnabled(value: string | null | undefined) {
  return value !== "false";
}

export default async function AdminSettingsPage() {
  const settings = await fetchAppSettings();
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const paymentMode = getPaymentMode();
  const companyDetails = getCompanyDetails();
  const paymentModeLabels = {
    demo: "Демо-шлюз",
    freedom: "Freedom Pay",
    halyk: "Halyk",
    manual: "Ручная обработка счета",
  };

  return (
    <div>
      <div className="rounded-card border border-black/10 bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Настройки</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Настройки DC Bakery</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
          Здесь можно временно включать и выключать нашу WhatsApp-логику без redeploy.
          Это удобно, пока к тому же номеру подключен второй бот.
        </p>
      </div>

      <section className="mt-6 grid gap-4">
        {settingControls.map((setting) => {
          const enabled = isEnabled(values.get(setting.key));

          return (
            <WhatsAppSettingControl
              description={setting.description}
              initialValue={enabled}
              key={setting.key}
              label={setting.label}
              settingKey={setting.key}
            />
          );
        })}
      </section>

      <section className="mt-6 rounded-card border border-black/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Оплата и документы</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-btn border border-black/5 bg-cream p-4">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Режим</p>
            <p className="mt-2 font-display text-xl font-semibold">{paymentModeLabels[paymentMode]}</p>
          </div>
          <div className="rounded-btn border border-black/5 bg-cream p-4">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Реквизиты</p>
            <p className="mt-2 font-display text-xl font-semibold">
              {hasCompleteCompanyDetails(companyDetails) ? "Готовы" : "Не заполнены"}
            </p>
          </div>
          <div className="rounded-btn border border-black/5 bg-cream p-4">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">Документы</p>
            <p className="mt-2 font-display text-xl font-semibold">Счет + АВР</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          Демо включается через <code>PAYMENT_MODE=demo</code>. Для рабочего запуска задаются
          реальные реквизиты и режим провайдера, после чего выполняется redeploy.
        </p>
      </section>

      <section className="mt-6 rounded-card border border-dark bg-dark p-6 text-white">
        <p className="font-display text-xl font-semibold">Как временно отключать</p>
        <p className="mt-3 text-sm leading-6 text-white/75">
          Самый мягкий режим: выключить только клиентский бот, а менеджерские команды оставить.
          Полное отключение используйте, если второй бот должен единолично обработать все сообщения.
        </p>
      </section>
    </div>
  );
}
