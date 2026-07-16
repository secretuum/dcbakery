import "server-only";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function authUrl(path: string) {
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return `${supabaseUrl}/auth/v1${path}`;
}

/** Проверка пары email+пароль через Supabase Auth (сам токен не сохраняем). */
export async function verifyClientPassword(
  email: string,
  password: string,
): Promise<"ok" | "invalid" | "unavailable"> {
  const url = authUrl("/token?grant_type=password");

  if (!url) {
    return "unavailable";
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (response.ok) {
      return "ok";
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return "invalid";
    }

    return "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Создаёт подтверждённого Supabase-пользователя для клиента. */
export async function createClientAuthUser(
  email: string,
  password: string,
): Promise<"created" | "already_exists" | "unavailable"> {
  const url = authUrl("/admin/users");

  if (!url || !serviceRoleKey) {
    return "unavailable";
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
      cache: "no-store",
    });

    if (response.ok) {
      return "created";
    }

    if (response.status === 422 || response.status === 409) {
      return "already_exists";
    }

    return "unavailable";
  } catch {
    return "unavailable";
  }
}
