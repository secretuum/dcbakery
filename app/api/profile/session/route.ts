import { NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from "@/src/lib/supabase/auth";
import { isAdminIdentity, type AdminIdentity } from "@/src/lib/admin-access";

type RefreshedAdminToken = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
};

type SupabaseUser = AdminIdentity & { id?: string };

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

function getCookieValue(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function isLocalHost(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function shouldUseSecureCookies(request: Request) {
  const host = request.headers.get("host") ?? "";

  return process.env.NODE_ENV === "production" && !isLocalHost(host);
}

async function getAdminUser(token: string): Promise<SupabaseUser | null> {
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

    return (await response.json()) as SupabaseUser;
  } catch {
    return null;
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

function unauthenticatedResponse() {
  return NextResponse.json({
    authenticated: false,
    role: null,
  });
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = getCookieValue(cookieHeader, ADMIN_ACCESS_COOKIE);
  const refreshToken = getCookieValue(cookieHeader, ADMIN_REFRESH_COOKIE);

  if (token) {
    const user = await getAdminUser(token);

    if (user && isAdminIdentity(user)) {
      return NextResponse.json({
        authenticated: true,
        email: user.email ?? "",
        role: "admin",
      });
    }
  }

  if (refreshToken) {
    const refreshed = await refreshAdminToken(refreshToken);

    if (refreshed) {
      const user = await getAdminUser(refreshed.access_token);

      if (user && isAdminIdentity(user)) {
        const response = NextResponse.json({
          authenticated: true,
          email: user.email ?? "",
          role: "admin",
        });
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
  }

  return unauthenticatedResponse();
}
