import "server-only";

type CachedToken = { token: string; expiresAt: number };

let cachedToken: CachedToken | null = null;
let pendingToken: Promise<string> | null = null;

export async function getIikoToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  if (pendingToken) {
    return pendingToken;
  }

  pendingToken = fetchIikoToken().finally(() => {
    pendingToken = null;
  });

  return pendingToken;
}

async function fetchIikoToken(): Promise<string> {
  const res = await fetch(`${process.env.IIKO_BASE_URL}/api/v2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiLogin: process.env.IIKO_API_LOGIN,
      appId: process.env.IIKO_APP_ID,
      clientSecret: process.env.IIKO_CLIENT_SECRET,
    }),
  });

  if (!res.ok) throw new Error(`iiko auth failed: ${res.status}`);

  const data = (await res.json()) as { token?: string };

  if (!data.token) throw new Error("iiko auth: no token in response");

  cachedToken = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.token;
}
