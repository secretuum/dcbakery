import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from "@/src/lib/supabase/auth";
import { getAdminRole, type AdminIdentity, type AdminRole } from "@/src/lib/admin-access";
import { isManagerMutationAllowed } from "@/src/lib/admin-role";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/src/i18n/config";

type RefreshedAdminToken = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
};

function getSupabaseAuthConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return {
    anonKey,
    authBaseUrl: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
  };
}

function isLocalHost(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function shouldUseSecureCookies(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  return process.env.NODE_ENV === "production" && !isLocalHost(host);
}

function clearAdminCookies(response: NextResponse) {
  response.cookies.delete(ADMIN_ACCESS_COOKIE);
  response.cookies.delete(ADMIN_REFRESH_COOKIE);
  return response;
}

// Роль по access-токену: "admin" | "manager" | null (null = токен не сотрудника/протух).
async function getTokenRole(token: string): Promise<AdminRole | null> {
  const config = getSupabaseAuthConfig();

  if (!config) {
    return null;
  }

  try {
    const response = await fetch(`${config.authBaseUrl}/user`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return getAdminRole((await response.json()) as AdminIdentity);
  } catch {
    return null;
  }
}

// Что торгпреду (роль manager) РАЗРЕШЕНО мутировать в админке. ТОЧНОЕ совпадение пути
// (не префикс!): иначе "/api/admin/clients" открыл бы и "/api/admin/clients/credit"
// (установка кредита) — этого торгпреду нельзя.
// - "/api/admin/clients" — создать клиента вручную без OTP (стадия 2).
// - "/api/admin/orders"  — оформить заявку от имени клиента (стадия 3). Приём заявки
//   (confirm/mark-paid и т.п.) сюда НЕ входит — остаётся только полному админу.
const MANAGER_ALLOWED_MUTATIONS: string[] = ["/api/admin/clients", "/api/admin/orders"];

// Гейт торгпреда: в админке он видит всё (GET), но любые мутации (POST/PATCH/PUT/DELETE),
// включая server actions (POST на /admin/*), доступны только полному админу — кроме
// точного белого списка выше. Возвращает 403, если действие запрещено, иначе null.
function managerMutationBlock(request: NextRequest): NextResponse | null {
  if (isManagerMutationAllowed(request.method, request.nextUrl.pathname, MANAGER_ALLOWED_MUTATIONS)) {
    return null;
  }
  return NextResponse.json(
    { error: "Недостаточно прав: это действие доступно только администратору." },
    { status: 403 },
  );
}

async function refreshAdminToken(refreshToken: string): Promise<RefreshedAdminToken | null> {
  const config = getSupabaseAuthConfig();

  if (!config) {
    return null;
  }

  try {
    const response = await fetch(`${config.authBaseUrl}/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!data.access_token || !data.refresh_token) {
      return null;
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in ?? 3600,
      refresh_token: data.refresh_token,
    };
  } catch {
    return null;
  }
}

// Админ-авторизация: логика без изменений, вызывается только для /admin и /api/admin.
async function adminProxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isPublicAdminRoute =
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/logout";

  if (isPublicAdminRoute) {
    return NextResponse.next();
  }

  if (isAdminApi && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");

    if (origin) {
      // За прокси (Render) request.nextUrl.host — внутренний хост инстанса, а не
      // публичный домен браузера; сверяем с forwarded/host, который видит клиент.
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
      const requestHost = forwardedHost || request.headers.get("host") || request.nextUrl.host;

      try {
        if (new URL(origin).host !== requestHost) {
          return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      }
    }
  }

  const token = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  // Роль по текущему токену, а если протух — по обновлённому (refresh).
  let role: AdminRole | null = token ? await getTokenRole(token) : null;
  let refreshed: RefreshedAdminToken | null = null;

  if (!role && refreshToken) {
    refreshed = await refreshAdminToken(refreshToken);
    if (refreshed) {
      role = await getTokenRole(refreshed.access_token);
    }
  }

  if (role) {
    // Торгпред (manager) видит всё, но опасные мутации блокируем (стадия 1).
    if (role === "manager") {
      const blocked = managerMutationBlock(request);
      if (blocked) {
        return blocked;
      }
    }

    const response = NextResponse.next();
    if (refreshed) {
      const secureCookies = shouldUseSecureCookies(request);
      response.cookies.set(ADMIN_ACCESS_COOKIE, refreshed.access_token, {
        httpOnly: true,
        maxAge: refreshed.expires_in,
        path: "/",
        sameSite: "lax",
        secure: secureCookies,
      });
      response.cookies.set(ADMIN_REFRESH_COOKIE, refreshed.refresh_token, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
        secure: secureCookies,
      });
    }
    return response;
  }

  if (isAdminApi) {
    return clearAdminCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", pathname);

  return clearAdminCookies(NextResponse.redirect(loginUrl));
}

// Служебные/метаданные-роуты Next без расширения (matcher ловит только их, т.к.
// файлы с точкой он уже исключает) — их НЕ локализуем.
const RESERVED_FIRST_SEGMENT = [
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
  "favicon",
  "manifest",
  "sitemap",
  "robots",
  "llms",
];

// Выбор языка для «голого» URL: cookie → Accept-Language → дефолт (ru).
function pickLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const primary = part.trim().split(";")[0].split("-")[0].toLowerCase();
      if (isLocale(primary)) {
        return primary;
      }
    }
  }

  return DEFAULT_LOCALE;
}

// Заглушка на время техобслуживания (env MAINTENANCE_MODE=1). Самодостаточный HTML
// (без внешних ассетов) — отдаётся прямо из middleware. 503 + Retry-After: краулерам
// это сигнал «временно», выдача не пострадает.
function maintenanceResponse(): NextResponse {
  const support = (process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? "").replace(/\D/g, "");
  const waLink = support
    ? `<a href="https://wa.me/${support}" style="color:#e5573f;font-weight:700;text-decoration:none">Написать в WhatsApp</a>`
    : "";
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Технические работы — DC Bakery</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fbf7f2;color:#2a1a12;padding:24px}.card{max-width:480px;text-align:center}.logo{display:inline-flex;width:56px;height:56px;align-items:center;justify-content:center;border-radius:12px;background:#e5573f;color:#fff;font-weight:800;font-size:20px;letter-spacing:.04em;margin-bottom:20px}h1{font-size:26px;margin:0 0 12px;font-weight:800}p{font-size:16px;line-height:1.6;color:#6b5b52;margin:0 0 8px}</style></head><body><div class="card"><div class="logo">DC</div><h1>Ведём технические работы</h1><p>Скоро вернёмся — сайт временно недоступен.</p><p>${waLink || "Спасибо за терпение."}</p></div></body></html>`;
  return new NextResponse(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "3600",
      "Cache-Control": "no-store",
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // [B3-проба, ВРЕМЕННО] пропускаем /{locale}/__rptest БЕЗ rewrite, чтобы реальный
  // сегмент app/[locale] получил параметр и можно было проверить next/root-params.
  // Удалить вместе с app/[locale]/__rptest после проверки.
  if (/^\/(kk|ru|en)\/__rptest(\/|$)/.test(pathname)) {
    return NextResponse.next();
  }

  // 1) Админка — прежняя авторизация (без языковых префиксов).
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return adminProxy(request);
  }

  // 2) Не локализуем: прочие API, оплата, документы и служебные роуты Next.
  const firstSegment = pathname.split("/")[1] ?? "";
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/pay") ||
    pathname.startsWith("/documents") ||
    RESERVED_FIRST_SEGMENT.some((r) => firstSegment === r || firstSegment.startsWith(`${r}-`))
  ) {
    return NextResponse.next();
  }

  // 2.5) Техобслуживание (env MAINTENANCE_MODE=1): сюда доходят ТОЛЬКО публичные
  //      страницы (админка/api/оплата/документы уже пропущены выше) → отдаём заглушку.
  if (process.env.MAINTENANCE_MODE === "1") {
    return maintenanceResponse();
  }

  // 3) Путь уже с языковым префиксом → rewrite: снимаем префикс и кладём язык в
  //    заголовок x-locale на ЗАПРОСЕ (только так его прочитает getLocale в RSC).
  if (isLocale(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(firstSegment.length + 1) || "/";

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", firstSegment);

    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.cookies.set(LOCALE_COOKIE, firstSegment, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  // 4) Голый путь без языка → 308 на выбранную локаль (сигналы SEO сохраняются).
  const locale = pickLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
