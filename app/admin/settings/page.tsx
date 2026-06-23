import type { Metadata } from "next";
import { updateAppSettingAction } from "@/app/admin/settings/actions";
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

  return (
    <div>
      <div className="rounded-card bg-white p-8 shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
        <p className="text-sm font-black uppercase text-raspberry">Настройки</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Настройки DC Bakery</h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-muted">
          Здесь можно временно включать и выключать нашу WhatsApp-логику без redeploy.
          Это удобно, пока к тому же номеру подключен второй бот.
        </p>
      </div>

      <section className="mt-6 grid gap-4">
        {settingControls.map((setting) => {
          const enabled = isEnabled(values.get(setting.key));

          return (
            <form
              action={updateAppSettingAction}
              className="rounded-card bg-white p-5 shadow-sm"
              key={setting.key}
            >
              <input name="key" type="hidden" value={setting.key} />
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xl font-black text-dark">{setting.label}</p>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted">
                    {setting.description}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase text-muted">
                    Ключ: {setting.key}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="min-h-11 rounded-xl border border-black/10 bg-cream px-4 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
                    defaultValue={enabled ? "true" : "false"}
                    name="value"
                  >
                    <option value="true">Включено</option>
                    <option value="false">Выключено</option>
                  </select>
                  <button
                    className="min-h-11 rounded-btn bg-coral px-5 py-2 text-sm font-black text-white transition hover:bg-coral-hover"
                    type="submit"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </form>
          );
        })}
      </section>

      <section className="mt-6 rounded-card bg-dark p-6 text-white shadow-sm">
        <p className="text-xl font-black">Как временно отключать</p>
        <p className="mt-3 text-sm font-semibold leading-6 text-white/75">
          Самый мягкий режим: выключить только клиентский бот, а менеджерские команды оставить.
          Полное отключение используйте, если второй бот должен единолично обработать все сообщения.
        </p>
      </section>
    </div>
  );
}
