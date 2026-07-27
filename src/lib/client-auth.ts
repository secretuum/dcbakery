import "server-only";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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
): Promise<"ok" | "invalid" | "unconfirmed" | "unavailable"> {
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
      const data = (await response.json().catch(() => ({}))) as {
        error_code?: string;
        error_description?: string;
        msg?: string;
      };
      const message = `${data.error_code ?? ""} ${data.error_description ?? ""} ${data.msg ?? ""}`.toLowerCase();

      if (message.includes("not confirmed") || message.includes("email_not_confirmed")) {
        return "unconfirmed";
      }

      return "invalid";
    }

    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export type SignUpResult = {
  status: "created_confirmed" | "created_unconfirmed" | "already_exists" | "unavailable";
  /** id пользователя Supabase (когда доступен) — для авто-подтверждения email после WhatsApp-кода */
  userId?: string;
};

/**
 * Регистрирует клиента через публичный signup: если в Supabase включено
 * подтверждение почты — письмо уйдёт автоматически, а вход откроется после клика
 * или после подтверждения по WhatsApp-коду (авто-подтверждение email по userId).
 */
export async function signUpClientAuthUser(
  email: string,
  password: string,
  redirectTo: string,
): Promise<SignUpResult> {
  const url = authUrl(`/signup?redirect_to=${encodeURIComponent(redirectTo)}`);

  if (!url) {
    return { status: "unavailable" };
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

    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      msg?: string;
      error_code?: string;
      identities?: unknown[];
      id?: string;
      user?: { id?: string };
    };

    if (response.ok) {
      // Повторный signup на занятую почту Supabase маскирует фейковым
      // пользователем без identities — считаем это "уже существует"
      if (Array.isArray(data.identities) && data.identities.length === 0) {
        return { status: "already_exists" };
      }

      const userId = data.id ?? data.user?.id;
      return { status: data.access_token ? "created_confirmed" : "created_unconfirmed", userId };
    }

    const message = `${data.error_code ?? ""} ${data.msg ?? ""}`.toLowerCase();
    if (message.includes("already") || response.status === 422 || response.status === 409) {
      return { status: "already_exists" };
    }

    return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Просит Supabase отправить письмо для сброса пароля (если такая почта есть). */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<boolean> {
  const url = authUrl(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`);

  if (!url) {
    return false;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}
