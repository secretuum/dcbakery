// Простой circuit breaker для внешних сервисов (AI/STT). Чистый модуль: время —
// через инъекцию now(), поэтому тестируется без таймеров. При N ошибках подряд
// «размыкается» и мгновенно отклоняет вызовы (fast-fail) на cooldown, затем один
// пробный вызов (half-open); успех → «замкнут», ошибка → снова разомкнут.

export type BreakerState = "closed" | "open" | "half_open";

export type CircuitBreaker = {
  /** Можно ли делать вызов сейчас (false — цепь разомкнута, cooldown не истёк). */
  canAttempt(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  state(): BreakerState;
};

export function createCircuitBreaker(opts: {
  failureThreshold?: number;
  cooldownMs?: number;
  now: () => number;
}): CircuitBreaker {
  const failureThreshold = opts.failureThreshold ?? 5;
  const cooldownMs = opts.cooldownMs ?? 30_000;

  let failures = 0;
  let openedAt = 0;
  let state: BreakerState = "closed";

  return {
    canAttempt() {
      if (state === "open") {
        if (opts.now() - openedAt >= cooldownMs) {
          state = "half_open"; // один пробный вызов
          return true;
        }
        return false;
      }
      return true; // closed | half_open
    },
    recordSuccess() {
      failures = 0;
      state = "closed";
    },
    recordFailure() {
      failures += 1;
      if (state === "half_open" || failures >= failureThreshold) {
        state = "open";
        openedAt = opts.now();
      }
    },
    state() {
      return state;
    },
  };
}
