import "server-only";
import { fetchAppSettings } from "@/src/lib/supabase/admin";
import { HOME_LAYOUT_KEY, sanitizeHomeLayout, type HomeLayout } from "./home-layout";

// Загрузка сохранённой раскладки главной. Если ключа нет, JSON битый или
// enabled=false — вернём выключенную пустую раскладку, и страница отрисуется
// классическим кодом (полностью обратимо).

export async function getHomeLayout(): Promise<HomeLayout> {
  try {
    const settings = await fetchAppSettings();
    const raw = settings.find((setting) => setting.key === HOME_LAYOUT_KEY)?.value;

    if (!raw) {
      return { enabled: false, sections: [] };
    }

    return sanitizeHomeLayout(JSON.parse(raw));
  } catch {
    return { enabled: false, sections: [] };
  }
}
