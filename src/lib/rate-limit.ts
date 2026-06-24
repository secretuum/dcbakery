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

const globalRateLimitStore = globalThis as typeof globalThis & {
  dcRateLimitStore?: Map<string, RateLimitEntry>;
};

const store = globalRateLimitStore.dcRateLimitStore ?? new Map<string, RateLimitEntry>();
globalRateLimitStore.dcRateLimitStore = store;

export function getRequestIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function checkRateLimit({
  identifier,
  limit,
  namespace,
  windowMs,
}: RateLimitOptions) {
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
