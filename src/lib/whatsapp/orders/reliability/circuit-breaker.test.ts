import { test } from "node:test";
import assert from "node:assert/strict";
import { createCircuitBreaker } from "./circuit-breaker";

test("замкнут по умолчанию, вызовы разрешены", () => {
  const b = createCircuitBreaker({ now: () => 0 });
  assert.equal(b.state(), "closed");
  assert.equal(b.canAttempt(), true);
});

test("N ошибок подряд размыкают цепь (fast-fail)", () => {
  const now = 0;
  const b = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, now: () => now });
  b.recordFailure();
  b.recordFailure();
  assert.equal(b.canAttempt(), true); // ещё не порог
  b.recordFailure();
  assert.equal(b.state(), "open");
  assert.equal(b.canAttempt(), false); // разомкнуто — отклоняем
});

test("после cooldown — half-open (один пробный вызов)", () => {
  let now = 0;
  const b = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => now });
  b.recordFailure();
  assert.equal(b.canAttempt(), false);
  now = 1000;
  assert.equal(b.canAttempt(), true); // cooldown истёк → half_open
  assert.equal(b.state(), "half_open");
});

test("успех в half-open замыкает цепь", () => {
  let now = 0;
  const b = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => now });
  b.recordFailure();
  now = 1000;
  b.canAttempt();
  b.recordSuccess();
  assert.equal(b.state(), "closed");
  assert.equal(b.canAttempt(), true);
});

test("ошибка в half-open снова размыкает", () => {
  let now = 0;
  const b = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => now });
  b.recordFailure();
  now = 1000;
  b.canAttempt(); // half_open
  b.recordFailure();
  assert.equal(b.state(), "open");
  now = 1500;
  assert.equal(b.canAttempt(), false); // cooldown ещё не истёк от нового openedAt
});
