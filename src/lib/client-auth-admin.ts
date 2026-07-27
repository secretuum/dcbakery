import "server-only";

// Админ-действия Supabase Auth на service-role (НЕ трогаем supabase/admin.ts).
// Используется только для авто-подтверждения email после успешного WhatsApp-кода:
// WhatsApp — доверенный канал регистрации, поэтому помечаем email подтверждённым,
// чтобы вход по паролю и гейт «аккаунт подтверждён» работали (это единый durabl-ный
// признак подтверждения, миграции не нужны).

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Помечает email пользователя подтверждённым. Возвращает true при успехе. */
export async function confirmClientEmailById(userId: string): Promise<boolean> {
  if (!supabaseUrl || !serviceRoleKey || !userId) {
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_confirm: true }),
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}
