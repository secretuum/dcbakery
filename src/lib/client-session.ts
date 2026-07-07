import "server-only";

export type ClientSessionPayload = {
  email: string;
  phone: string;
  companyName: string;
  accountantPhone: string;
  exp: number;
};

export const CLIENT_SESSION_COOKIE = "dc_client_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function secret() {
  return process.env.CLIENT_SESSION_SECRET ?? "dev-only-insecure-please-set-env";
}

async function hmacKey(usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function signClientSession(payload: ClientSessionPayload): Promise<string> {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await hmacKey("sign");
  const sig = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)),
  ).toString("hex");
  return `${data}.${sig}`;
}

export async function verifyClientSession(value: string): Promise<ClientSessionPayload | null> {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const data = value.slice(0, dot);
  const sigHex = value.slice(dot + 1);
  try {
    const key = await hmacKey("verify");
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(sigHex, "hex"),
      new TextEncoder().encode(data),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString(),
    ) as ClientSessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
