import "server-only";
import type { CompanyRecord } from "./company-check";
import { isValidBin } from "./company-check";
import { parsePrgAppCompany } from "./company-registry-parse";

// Сетевой провайдер госреестра по БИН. Best-effort: любая ошибка/таймаут/битый
// ответ → null (МЯГКИЙ сигнал, заказ не блокируем). Источник — apiba.prgapp.kz
// (бэкенд ba.prg.kz), без ключа, ~20000 запросов/7дней на IP. Обоснование и
// запасной путь (data.egov.kz) — docs/antifraud/bin-name-check-plan.md §3.

const DEFAULT_BASE = "https://apiba.prgapp.kz";
const TIMEOUT_MS = 4000;
// Реестр обновляется раз в сутки — кэшируем ответ, чтобы не жечь лимит и не ходить
// в сеть на каждый рендер карточки заказа.
const CACHE_TTL_SECONDS = 60 * 60 * 12;

/**
 * Официальные данные юрлица/ИП по БИН, либо null, если БИН невалиден или реестр
 * недоступен. Никогда не бросает.
 */
export async function lookupCompanyByBin(bin: string | null | undefined): Promise<CompanyRecord | null> {
  if (!isValidBin(bin)) return null;
  const base = (process.env.COMPANY_REGISTRY_URL || DEFAULT_BASE).replace(/\/$/, "");
  const url = `${base}/CompanyFullInfo?id=${encodeURIComponent(bin!.trim())}&lang=ru`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (DC Bakery antifraud)", Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_TTL_SECONDS },
    });
    if (!response.ok) return null;
    const json = await response.json();
    return parsePrgAppCompany(json);
  } catch (error) {
    console.error("[antifraud] company registry lookup failed:", error);
    return null;
  }
}
