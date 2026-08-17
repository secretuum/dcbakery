// ЧИСТЫЙ парсер ответа apiba.prgapp.kz/CompanyFullInfo → CompanyRecord.
// Вынесен из сетевого company-registry.ts, чтобы маппинг был покрыт тестами на
// реальной фикстуре (node:test не импортирует server-only модули). Формат API
// недокументирован → доступ везде опциональный, лишние поля игнорируем.
// Раскладка полей и коды реестров — docs/antifraud/bin-name-check-plan.md §3.1.

import type { CompanyRecord } from "./company-check";

/** Коды `reestrs[].violation` (КГД). Названия — из ответа API. */
const V_INACTIVE = 0; // бездействующий
const V_TAX_DEBT = 2; // налоговая задолженность
const V_BANKRUPT = 3; // банкрот
const V_FAKE = 4; // лжепредприятие
const V_REG_INVALID = 5; // регистрация признана недействительной
const V_REREG_INVALID = 7; // перерегистрация недействительна

type Reestr = { violation?: number | null; isIntruder?: boolean | null; description?: string | null };

/** Значение поля вида `{ value: T }` (реестр оборачивает почти всё в объект с value). */
function val<T>(field: unknown): T | null {
  if (field && typeof field === "object" && "value" in field) {
    return (field as { value: T | null }).value ?? null;
  }
  return null;
}

function str(field: unknown): string | null {
  const v = val<unknown>(field);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Есть ли нарушитель (isIntruder) в реестре с данным кодом violation. */
function intruder(reestrs: Reestr[], code: number): boolean {
  return reestrs.some((r) => r?.isIntruder === true && r?.violation === code);
}

export function parsePrgAppCompany(raw: unknown): CompanyRecord {
  const root = (raw ?? {}) as Record<string, unknown>;
  const basic = (root.basicInfo ?? {}) as Record<string, unknown>;
  const reestrs = Array.isArray(root.reestrs) ? (root.reestrs as Reestr[]) : [];

  const titleRu = str(basic.titleRu);
  const titleKz = str(basic.titleKz);
  const found = Boolean(titleRu || titleKz) && basic.isDeleted !== true;

  // status — ДВОЙНАЯ обёртка: basic.status.value = { value: 0, description: "Активен" }
  // (в отличие от titleRu/addressRu, где .value — сразу строка). Проверено на живом API.
  const statusInner = (val<unknown>(basic.status) ?? {}) as { value?: unknown; description?: unknown };
  const status =
    typeof statusInner.description === "string" && statusInner.description.trim()
      ? statusInner.description.trim()
      : null;
  // Активен, если статус говорит «актив…» или code===0 (наблюдаемый код «Активен»).
  const statusActive = status ? /актив/i.test(status) : statusInner.value === 0 ? true : null;

  const debts = ((root.debtsInfo ?? {}) as Record<string, unknown>).kgd as
    | { totalDebt?: unknown; totalFine?: unknown }
    | undefined;
  const debtTotal =
    (typeof debts?.totalDebt === "number" ? debts.totalDebt : 0) +
    (typeof debts?.totalFine === "number" ? debts.totalFine : 0);

  const ceoTitle = (() => {
    const ceoVal = val<unknown>(basic.ceo);
    if (ceoVal && typeof ceoVal === "object" && "title" in ceoVal) {
      const t = (ceoVal as { title?: unknown }).title;
      return typeof t === "string" && t.trim() ? t.trim() : null;
    }
    return null;
  })();

  const cityName =
    (typeof basic.cityName === "string" && basic.cityName.trim() ? basic.cityName.trim() : null) ??
    (() => {
      const crumbs = basic.crumbsKato as { nameRu?: unknown } | undefined;
      return typeof crumbs?.nameRu === "string" && crumbs.nameRu.trim() ? crumbs.nameRu.trim() : null;
    })();

  return {
    found,
    isIndividual: basic.isIndividual === true,
    titleRu,
    titleKz,
    status,
    cityName,
    addressRu: str(basic.addressRu),
    ceo: ceoTitle,
    primaryOked: str(basic.primaryOKED),
    flags: {
      fakeCompany: intruder(reestrs, V_FAKE),
      bankrupt: intruder(reestrs, V_BANKRUPT),
      inactive:
        intruder(reestrs, V_INACTIVE) ||
        intruder(reestrs, V_REG_INVALID) ||
        intruder(reestrs, V_REREG_INVALID) ||
        statusActive === false,
      taxDebt: intruder(reestrs, V_TAX_DEBT) || debtTotal > 0,
      badGoszakup: reestrs.some(
        (r) => r?.isIntruder === true && /недобросов/i.test(r?.description ?? ""),
      ),
    },
    debtTotal,
  };
}
