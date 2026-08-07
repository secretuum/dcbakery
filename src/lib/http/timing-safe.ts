import { timingSafeEqual } from "node:crypto";

/**
 * Сравнение строк (токенов/секретов) в ПОСТОЯННОЕ время — чтобы по времени ответа нельзя
 * было подбирать секрет посимвольно. Длину сравниваем обычным способом (длина секретом не
 * является). `null`/`undefined` → `false` (нет заголовка/параметра = не авторизован).
 *
 * Единый хелпер для роутов с bearer-секретом (1c-экспорт, cron и т.п.). В `whatsapp/webhook`
 * и `payments/webhook` живут свои локальные копии этой же логики — при желании их можно
 * перевести на этот хелпер отдельным рефакторингом.
 */
export function timingSafeCompare(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
