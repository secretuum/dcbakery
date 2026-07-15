import "server-only";
import { isDemoPaymentMode } from "@/src/lib/payments";

export type CompanyDetails = {
  address: string;
  bankBic: string;
  bankIban: string;
  /** Счёт «Цех полуфабрикатов»; пустая строка — второй счёт не настроен, всё идёт на основной */
  bankIbanPf: string;
  bankName: string;
  bin: string;
  directorName: string;
  legalName: string;
  isDemo: boolean;
  taxNote: string;
};

const demoCompanyDetails = {
  address: "г. Алматы, ул. Демо, 15",
  bankBic: "DEMOKZKX",
  bankIban: "KZ00DEMO000000000001",
  bankIbanPf: "KZ00DEMO000000000002",
  bankName: "АО «Учебный банк»",
  bin: "000000000000",
  directorName: "Тестовый руководитель",
  legalName: "ТОО «DC Bakery Demo»",
  taxNote: "Без НДС. Демо-документ, не является основанием для оплаты.",
};

export function getCompanyDetails(): CompanyDetails {
  const isDemo = isDemoPaymentMode();

  return {
    address: process.env.DC_LEGAL_ADDRESS?.trim() || (isDemo ? demoCompanyDetails.address : ""),
    bankBic: process.env.DC_BANK_BIC?.trim() || (isDemo ? demoCompanyDetails.bankBic : ""),
    bankIban: process.env.DC_BANK_IBAN?.trim() || (isDemo ? demoCompanyDetails.bankIban : ""),
    bankIbanPf:
      process.env.DC_BANK_IBAN_PF?.trim() || (isDemo ? demoCompanyDetails.bankIbanPf : ""),
    bankName: process.env.DC_BANK_NAME?.trim() || (isDemo ? demoCompanyDetails.bankName : ""),
    bin: process.env.DC_LEGAL_BIN?.trim() || (isDemo ? demoCompanyDetails.bin : ""),
    directorName:
      process.env.DC_DIRECTOR_NAME?.trim() || (isDemo ? demoCompanyDetails.directorName : ""),
    legalName:
      process.env.DC_LEGAL_NAME?.trim() || (isDemo ? demoCompanyDetails.legalName : ""),
    isDemo,
    taxNote: process.env.DC_TAX_NOTE?.trim() || (isDemo ? demoCompanyDetails.taxNote : ""),
  };
}

export function hasCompleteCompanyDetails(details: CompanyDetails) {
  return Boolean(
    details.legalName &&
      details.bin &&
      details.address &&
      details.bankName &&
      details.bankBic &&
      details.bankIban &&
      details.directorName &&
      details.taxNote,
  );
}
