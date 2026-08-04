import "server-only";
import type { Client } from "@/src/types";
import { fetchClientByPhone, fetchClientByEmail, upsertClient } from "@/src/lib/supabase/admin";
import { canonicalClientPhone, canonicalClientEmail } from "./canonical";

export type EnsureClientInput = {
  phone: string;
  companyName: string;
  email?: string | null;
};

/**
 * Гарантирует строку `clients` для самозарегистрированного клиента, чтобы к нему
 * применялись кредит-проверки заказа (иначе canPlaceOrder пропускается — клиент
 * невидим для лимита/предоплаты). НЕ трогает существующую строку — менеджерские
 * кредитные условия (credit_limit/terms/status) священны. Новая строка —
 * предоплатная: credit_limit=0 ⇒ getCreditState даёт prepay_only.
 *
 * Best-effort: любые ошибки (сеть, гонка по UNIQUE(phone) при параллельной
 * регистрации) глотаем — регистрация клиента не должна падать из-за биллинг-строки.
 */
export async function ensureClientRecord(input: EnsureClientInput): Promise<Client | null> {
  const phone = canonicalClientPhone(input.phone);
  if (!phone) return null;
  const email = canonicalClientEmail(input.email);

  try {
    const existingByPhone = await fetchClientByPhone(phone);
    if (existingByPhone) return existingByPhone;
    if (email) {
      const existingByEmail = await fetchClientByEmail(email);
      if (existingByEmail) return existingByEmail;
    }

    const name = input.companyName.trim() || phone;
    // Без id → POST (БД генерит id, применяет DEFAULT'ы). credit_limit=0 задаём
    // явно — это денежный гейт (предоплата). Кредитные поля из регистрации больше
    // никогда не пишем.
    return await upsertClient({ name, phone, email, credit_limit: 0 });
  } catch {
    return null;
  }
}
