import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from "@/src/lib/supabase/auth";
import { isAdminIdentity, type AdminIdentity } from "@/src/lib/admin-access";

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

async function isValidAdminToken(token: string) {
  const config = getSupabaseAuthConfig();

  if (!config) {
    return false;
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
      return false;
    }

    return isAdminIdentity((await response.json()) as AdminIdentity);
  } catch {
    return false;
  }
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isPublicAdminRoute =
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/logout";

  if ((!isAdminPage && !isAdminApi) || isPublicAdminRoute) {
    return NextResponse.next();
  }

  if (isAdminApi && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");

    if (origin) {
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const requestHost = forwardedHost || request.nextUrl.host;

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

  if (token && (await isValidAdminToken(token))) {
    return NextResponse.next();
  }

  if (refreshToken) {
    const refreshed = await refreshAdminToken(refreshToken);

    if (refreshed) {
      const response = NextResponse.next();
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

      return response;
    }
  }

  if (isAdminApi) {
    return clearAdminCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", pathname);

  return clearAdminCookies(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
