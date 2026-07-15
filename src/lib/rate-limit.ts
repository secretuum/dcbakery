import "server-only";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  identifier: string;
  limit: number;
  namespace: string;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const REDIS_TIMEOUT_MS = 2000;

const globalRateLimitStore = globalThis as typeof globalThis & {
  dcRateLimitStore?: Map<string, RateLimitEntry>;
};

const store = globalRateLimitStore.dcRateLimitStore ?? new Map<string, RateLimitEntry>();
globalRateLimitStore.dcRateLimitStore = store;

export function getRequestIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
    ?.split(",").at(-1)?.trim();

  return (
    forwardedFor ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function checkRateLimitInMemory({
  identifier,
  limit,
  namespace,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = `${namespace}:${identifier}`;
  const currentEntry = store.get(key);

  if (!currentEntry || currentEntry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (currentEntry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((currentEntry.resetAt - now) / 1000)),
    };
  }

  currentEntry.count += 1;

  if (store.size > 10_000) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(entryKey);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(limit - currentEntry.count, 0),
    retryAfterSeconds: Math.max(1, Math.ceil((currentEntry.resetAt - now) / 1000)),
  };
}

async function checkRateLimitRedis(
  restUrl: string,
  restToken: string,
  { identifier, limit, namespace, windowMs }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const key = `rl:${namespace}:${identifier}:${windowIndex}`;
  const windowEndsAt = (windowIndex + 1) * windowMs;

  const response = await fetch(`${restUrl.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restToken}`,
      "Content-Type": "application/json",
    },
    // TTL чуть больше окна — ключ нужен только как счётчик текущего окна
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, windowMs + 1000, "NX"],
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Upstash HTTP ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const incrResult = results?.[0];

  if (!incrResult || incrResult.error || typeof incrResult.result !== "number") {
    throw new Error(incrResult?.error ?? "Upstash: unexpected pipeline response");
  }

  const count = incrResult.result;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndsAt - now) / 1000));

  return {
    allowed: count <= limit,
    remaining: Math.max(limit - count, 0),
    retryAfterSeconds,
  };
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl || !restToken) {
    return checkRateLimitInMemory(options);
  }

  try {
    return await checkRateLimitRedis(restUrl, restToken, options);
  } catch (error) {
    // Redis недоступен — деградируем до per-instance лимита, не блокируем запрос
    console.error("[rate-limit] Redis check failed, falling back to in-memory:", error);
    return checkRateLimitInMemory(options);
  }
}
