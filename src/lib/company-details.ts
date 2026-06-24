import "server-only";

export type CompanyDetails = {
  address: string;
  bankBic: string;
  bankIban: string;
  bankName: string;
  bin: string;
  directorName: string;
  legalName: string;
  taxNote: string;
};

export function getCompanyDetails(): CompanyDetails {
  return {
    address: process.env.DC_LEGAL_ADDRESS?.trim() ?? "",
    bankBic: process.env.DC_BANK_BIC?.trim() ?? "",
    bankIban: process.env.DC_BANK_IBAN?.trim() ?? "",
    bankName: process.env.DC_BANK_NAME?.trim() ?? "",
    bin: process.env.DC_LEGAL_BIN?.trim() ?? "",
    directorName: process.env.DC_DIRECTOR_NAME?.trim() ?? "",
    legalName: process.env.DC_LEGAL_NAME?.trim() ?? "",
    taxNote: process.env.DC_TAX_NOTE?.trim() ?? "",
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
