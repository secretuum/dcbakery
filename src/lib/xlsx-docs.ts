import "server-only";
import ExcelJS from "exceljs";
import type { CompanyDetails } from "@/src/lib/company-details";
import { nomenclatureCode } from "@/src/data/nomenclature-1c";
import type { Order, OrderItem } from "@/src/types";

// Формальные Excel-документы по казахстанским типовым формам (приказ МФ РК № 562):
// накладная на отпуск запасов на сторону (З-2) и акт выполненных работ (Р-1).
// Скачиваются как настоящие .xlsx — вместо печати страницы браузером.

const FONT = "Times New Roman";

function money(value: number) {
  return Math.round(value * 100) / 100;
}

// ── Сумма прописью (тенге) ──

const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const onesF = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const teens = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function tripleToWords(value: number, feminine: boolean) {
  const words: string[] = [];
  const h = Math.floor(value / 100);
  const rest = value % 100;

  if (h > 0) {
    words.push(hundreds[h]);
  }

  if (rest >= 10 && rest < 20) {
    words.push(teens[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t > 0) {
      words.push(tens[t]);
    }
    if (o > 0) {
      words.push(feminine ? onesF[o] : ones[o]);
    }
  }

  return words.join(" ");
}

function plural(value: number, forms: [string, string, string]) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function amountInWordsKzt(amount: number) {
  const whole = Math.floor(amount);
  const tiyn = Math.round((amount - whole) * 100);

  if (whole === 0) {
    return `ноль теңге ${String(tiyn).padStart(2, "0")} тиын`;
  }

  const billions = Math.floor(whole / 1_000_000_000);
  const millions = Math.floor((whole % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((whole % 1_000_000) / 1_000);
  const units = whole % 1000;
  const parts: string[] = [];

  if (billions > 0) {
    parts.push(tripleToWords(billions, false), plural(billions, ["миллиард", "миллиарда", "миллиардов"]));
  }
  if (millions > 0) {
    parts.push(tripleToWords(millions, false), plural(millions, ["миллион", "миллиона", "миллионов"]));
  }
  if (thousands > 0) {
    parts.push(tripleToWords(thousands, true), plural(thousands, ["тысяча", "тысячи", "тысяч"]));
  }
  if (units > 0) {
    parts.push(tripleToWords(units, false));
  }

  const text = `${parts.filter(Boolean).join(" ")} теңге ${String(tiyn).padStart(2, "0")} тиын`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ── Общие помощники разметки ──

type Ws = ExcelJS.Worksheet;

function formatDateRu(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Asia/Almaty" }).format(date);
}

function setCell(
  ws: Ws,
  address: string,
  value: ExcelJS.CellValue,
  options: {
    bold?: boolean;
    size?: number;
    align?: "left" | "center" | "right";
    wrap?: boolean;
    border?: boolean;
    italic?: boolean;
  } = {},
) {
  const cell = ws.getCell(address);
  cell.value = value;
  cell.font = {
    name: FONT,
    size: options.size ?? 10,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
  };
  cell.alignment = {
    horizontal: options.align ?? "left",
    vertical: "middle",
    wrapText: options.wrap ?? false,
  };
  if (options.border) {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }
}

function tableCell(ws: Ws, row: number, col: number, value: ExcelJS.CellValue, options: {
  bold?: boolean;
  align?: "left" | "center" | "right";
  numFmt?: string;
} = {}) {
  const cell = ws.getRow(row).getCell(col);
  cell.value = value;
  cell.font = { name: FONT, size: 10, bold: options.bold ?? false };
  cell.alignment = { horizontal: options.align ?? "left", vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  if (options.numFmt) {
    cell.numFmt = options.numFmt;
  }
}

function setupPage(ws: Ws) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
}

const NUM_FMT = "#,##0.00";

// ── Накладная на отпуск запасов на сторону (форма З-2) ──

export type NaklSection = {
  label: string | null;
  suffix: string;
  items: OrderItem[];
};

export async function buildNaklWorkbook(
  order: Order,
  sections: NaklSection[],
  company: CompanyDetails,
) {
  const wb = new ExcelJS.Workbook();

  // Подписанты формы З-2 (те же env, что и на печатной странице накладной).
  const supplyResponsible = process.env.DC_SUPPLY_RESPONSIBLE?.trim() || company.directorName;
  const chiefAccountant = process.env.DC_CHIEF_ACCOUNTANT?.trim() || "";

  for (const section of sections) {
    const ws = wb.addWorksheet(section.label ?? "Накладная", {
      properties: { defaultRowHeight: 14 },
    });
    setupPage(ws);
    ws.columns = [
      { width: 5 },   // A № п/п
      { width: 36 },  // B наименование
      { width: 11 },  // C номенкл. №
      { width: 8 },   // D ед.
      { width: 9 },   // E кол-во
      { width: 12 },  // F цена
      { width: 13 },  // G сумма
      { width: 12 },  // H сумма НДС
    ];

    ws.mergeCells("F1:H1");
    setCell(ws, "F1", "Приложение 26 к приказу Министра финансов", { size: 8, align: "right" });
    ws.mergeCells("F2:H2");
    setCell(ws, "F2", "Республики Казахстан от 20.12.2012 № 562", { size: 8, align: "right" });
    ws.mergeCells("F3:H3");
    setCell(ws, "F3", "Форма З-2", { size: 8, align: "right", bold: true });

    const number = `${order.order_number}${section.suffix}`;
    ws.mergeCells("A5:H5");
    setCell(ws, "A5", `НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ № ${number}`, {
      bold: true, size: 12, align: "center",
    });
    ws.mergeCells("A6:H6");
    setCell(ws, "A6", `от ${formatDateRu(order.created_at)}${section.label ? ` · ${section.label}` : ""}`, {
      align: "center", size: 10,
    });

    ws.mergeCells("A8:H8");
    setCell(ws, "A8", `Организация (отправитель): ${company.legalName}, БИН ${company.bin}, ${company.address}`, { wrap: true });
    ws.mergeCells("A9:H9");
    setCell(
      ws,
      "A9",
      `Получатель: ${order.company_name}${order.customer_bin ? `, БИН/ИИН ${order.customer_bin}` : ""}${order.delivery_address ? `, ${order.delivery_address}` : ""}`,
      { wrap: true },
    );
    ws.mergeCells("A10:H10");
    setCell(ws, "A10", `Ответственный за поставку: ${supplyResponsible || "—"}`);
    ws.mergeCells("A11:H11");
    setCell(
      ws,
      "A11",
      `Основание: заявка № ${order.order_number}${order.delivery_date ? `, дата поставки ${formatDateRu(order.delivery_date)}` : ""}`,
    );

    // Таблица
    const headRow = 13;
    const headers = [
      "№ п/п",
      "Наименование, характеристика (сорт, артикул)",
      "Номенкл. №",
      "Ед. изм.",
      "Количество",
      "Цена за единицу, ₸",
      "Сумма, ₸",
      "Сумма НДС, ₸",
    ];
    headers.forEach((title, index) => {
      tableCell(ws, headRow, index + 1, title, { bold: true, align: "center" });
    });
    ws.getRow(headRow).height = 30;

    let row = headRow + 1;
    let total = 0;
    section.items.forEach((item, index) => {
      total += item.total_amount;
      tableCell(ws, row, 1, index + 1, { align: "center" });
      tableCell(ws, row, 2, item.product_name);
      tableCell(ws, row, 3, nomenclatureCode(item.product_id), { align: "center" });
      tableCell(ws, row, 4, item.unit || "шт", { align: "center" });
      tableCell(ws, row, 5, item.qty, { align: "center" });
      tableCell(ws, row, 6, money(item.price), { align: "right", numFmt: NUM_FMT });
      tableCell(ws, row, 7, money(item.total_amount), { align: "right", numFmt: NUM_FMT });
      tableCell(ws, row, 8, "—", { align: "center" });
      row++;
    });

    ws.mergeCells(`A${row}:F${row}`);
    tableCell(ws, row, 1, "Итого", { bold: true, align: "right" });
    tableCell(ws, row, 7, money(total), { bold: true, align: "right", numFmt: NUM_FMT });
    tableCell(ws, row, 8, "—", { bold: true, align: "center" });
    row += 2;

    ws.mergeCells(`A${row}:H${row}`);
    setCell(
      ws,
      `A${row}`,
      `Всего отпущено ${section.items.length} ${plural(section.items.length, ["наименование", "наименования", "наименований"])} на сумму: ${amountInWordsKzt(total)}`,
      { wrap: true, italic: true },
    );
    row++;
    ws.mergeCells(`A${row}:H${row}`);
    setCell(ws, `A${row}`, company.taxNote, { size: 9 });
    row += 3;

    setCell(ws, `A${row}`, "Отпуск разрешил:", { bold: true });
    ws.mergeCells(`B${row}:D${row}`);
    setCell(ws, `B${row}`, `Руководитель ____________________ ${company.directorName}`, { wrap: true });
    ws.mergeCells(`F${row}:H${row}`);
    setCell(ws, `F${row}`, "М.П.", { align: "right" });
    row += 2;
    setCell(ws, `A${row}`, "Главный бухгалтер:", { bold: true });
    ws.mergeCells(`B${row}:D${row}`);
    setCell(ws, `B${row}`, `____________________ ${chiefAccountant}`);
    row += 2;
    setCell(ws, `A${row}`, "Отпустил:", { bold: true });
    ws.mergeCells(`B${row}:D${row}`);
    setCell(ws, `B${row}`, `____________________ ${supplyResponsible}`);
    row += 2;
    setCell(ws, `A${row}`, "Получил:", { bold: true });
    ws.mergeCells(`B${row}:F${row}`);
    setCell(
      ws,
      `B${row}`,
      `по доверенности № ______ от __________  ____________________ ${order.customer_name} (${order.company_name})`,
      { wrap: true },
    );

    if (company.isDemo) {
      ws.mergeCells("A4:H4");
      setCell(ws, "A4", "ДЕМО-ДОКУМЕНТ — не является основанием для отпуска", {
        bold: true, align: "center", size: 11,
      });
    }
  }

  return wb.xlsx.writeBuffer();
}

// ── Счёт на оплату (свободная форма РК, реквизитная шапка как в 1С) ──

export type InvoiceSection = {
  label: string | null;
  number: string;
  iban: string;
  items: OrderItem[];
  totalAmount: number;
};

export type InvoiceOptions = {
  issuedAt: string;
  validUntil: string;
  /** Кбе бенефициара, если задан бухгалтером (env DC_KBE) */
  kbe?: string;
  /** Код назначения платежа, если задан бухгалтером (env DC_KNP) */
  knp?: string;
};

export async function buildInvoiceWorkbook(
  order: Order,
  invoices: InvoiceSection[],
  company: CompanyDetails,
  options: InvoiceOptions,
) {
  const wb = new ExcelJS.Workbook();

  for (const invoice of invoices) {
    const ws = wb.addWorksheet(invoice.label ?? "Счет", {
      properties: { defaultRowHeight: 14 },
    });
    setupPage(ws);
    ws.columns = [
      { width: 5 },   // A №
      { width: 42 },  // B наименование
      { width: 9 },   // C ед.
      { width: 10 },  // D кол-во
      { width: 13 },  // E цена
      { width: 15 },  // F сумма
    ];

    ws.mergeCells("A1:F1");
    setCell(
      ws,
      "A1",
      "Внимание! Оплата данного счета означает согласие с условиями поставки товара (публичная оферта dc-bakery.kz/oferta).",
      { size: 8, wrap: true, italic: true },
    );

    // Реквизитная шапка бенефициара
    ws.mergeCells("A3:D3");
    setCell(ws, "A3", `Бенефициар: ${company.legalName}, БИН ${company.bin}`, { border: true, wrap: true, bold: true });
    ws.mergeCells("E3:F3");
    setCell(ws, "E3", `ИИК: ${invoice.iban}`, { border: true, wrap: true, bold: true });
    ws.mergeCells("A4:D4");
    setCell(ws, "A4", `Банк бенефициара: ${company.bankName}`, { border: true, wrap: true });
    ws.mergeCells("E4:F4");
    setCell(
      ws,
      "E4",
      `БИК: ${company.bankBic}${options.kbe ? `   Кбе: ${options.kbe}` : ""}${options.knp ? `   КНП: ${options.knp}` : ""}`,
      { border: true, wrap: true },
    );

    ws.mergeCells("A6:F6");
    setCell(ws, "A6", `СЧЕТ НА ОПЛАТУ № ${invoice.number} от ${formatDateRu(options.issuedAt)}`, {
      bold: true, size: 13, align: "center",
    });
    if (invoice.label) {
      ws.mergeCells("A7:F7");
      setCell(ws, "A7", invoice.label, { align: "center", size: 10 });
    }

    ws.mergeCells("A9:F9");
    setCell(ws, "A9", `Поставщик: ${company.legalName}, БИН ${company.bin}, ${company.address}`, { wrap: true });
    ws.mergeCells("A10:F10");
    setCell(
      ws,
      "A10",
      `Покупатель: ${order.company_name}${order.customer_bin ? `, БИН/ИИН ${order.customer_bin}` : ""}${order.delivery_address ? `, ${order.delivery_address}` : ""}`,
      { wrap: true },
    );
    ws.mergeCells("A11:F11");
    setCell(
      ws,
      "A11",
      `Основание: заявка № ${order.order_number}${order.delivery_date ? `, дата поставки ${formatDateRu(order.delivery_date)}` : ""}`,
    );

    const headRow = 13;
    const headers = ["№", "Наименование", "Ед. изм.", "Кол-во", "Цена, ₸", "Сумма, ₸"];
    headers.forEach((title, index) => {
      tableCell(ws, headRow, index + 1, title, { bold: true, align: "center" });
    });
    ws.getRow(headRow).height = 22;

    let row = headRow + 1;
    invoice.items.forEach((item, index) => {
      tableCell(ws, row, 1, index + 1, { align: "center" });
      tableCell(ws, row, 2, item.product_name);
      tableCell(ws, row, 3, item.unit || "шт", { align: "center" });
      tableCell(ws, row, 4, item.qty, { align: "center" });
      tableCell(ws, row, 5, money(item.price), { align: "right", numFmt: NUM_FMT });
      tableCell(ws, row, 6, money(item.total_amount), { align: "right", numFmt: NUM_FMT });
      row++;
    });

    ws.mergeCells(`A${row}:E${row}`);
    tableCell(ws, row, 1, "Итого к оплате", { bold: true, align: "right" });
    tableCell(ws, row, 6, money(invoice.totalAmount), { bold: true, align: "right", numFmt: NUM_FMT });
    row += 2;

    ws.mergeCells(`A${row}:F${row}`);
    setCell(
      ws,
      `A${row}`,
      `Всего наименований ${invoice.items.length}, на сумму: ${amountInWordsKzt(invoice.totalAmount)}`,
      { wrap: true, italic: true },
    );
    row++;
    ws.mergeCells(`A${row}:F${row}`);
    setCell(ws, `A${row}`, company.taxNote, { size: 9 });
    row++;
    ws.mergeCells(`A${row}:F${row}`);
    setCell(ws, `A${row}`, `Счет действителен до ${formatDateRu(options.validUntil)}.`, { bold: true });
    row += 3;

    setCell(ws, `A${row}`, "Исполнитель:", { bold: true });
    ws.mergeCells(`B${row}:D${row}`);
    setCell(ws, `B${row}`, `____________________ ${company.directorName}`);
    ws.mergeCells(`E${row}:F${row}`);
    setCell(ws, `E${row}`, "М.П.", { align: "right" });

    if (company.isDemo) {
      ws.mergeCells("A2:F2");
      setCell(ws, "A2", "ДЕМО-ДОКУМЕНТ. НЕ ОПЛАЧИВАТЬ", { bold: true, align: "center", size: 11 });
    }
  }

  return wb.xlsx.writeBuffer();
}

// ── Акт выполненных работ / оказанных услуг (форма Р-1) ──

export async function buildAvrWorkbook(order: Order, items: OrderItem[], company: CompanyDetails) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("АВР", { properties: { defaultRowHeight: 14 } });
  setupPage(ws);
  ws.columns = [
    { width: 5 },   // A №
    { width: 44 },  // B наименование
    { width: 9 },   // C ед.
    { width: 10 },  // D кол-во
    { width: 13 },  // E цена
    { width: 15 },  // F сумма
  ];

  ws.mergeCells("D1:F1");
  setCell(ws, "D1", "Приложение 50 к приказу Министра финансов", { size: 8, align: "right" });
  ws.mergeCells("D2:F2");
  setCell(ws, "D2", "Республики Казахстан от 20.12.2012 № 562", { size: 8, align: "right" });
  ws.mergeCells("D3:F3");
  setCell(ws, "D3", "Форма Р-1", { size: 8, align: "right", bold: true });

  ws.mergeCells("A5:F5");
  setCell(ws, "A5", `АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ) № ${order.order_number}`, {
    bold: true, size: 12, align: "center",
  });
  ws.mergeCells("A6:F6");
  setCell(ws, "A6", `от ${formatDateRu(order.created_at)}`, { align: "center" });

  ws.mergeCells("A8:F8");
  setCell(ws, "A8", `Исполнитель: ${company.legalName}, БИН ${company.bin}, ${company.address}`, { wrap: true });
  ws.mergeCells("A9:F9");
  setCell(
    ws,
    "A9",
    `Заказчик: ${order.company_name}${order.customer_bin ? `, БИН/ИИН ${order.customer_bin}` : ""}`,
    { wrap: true },
  );
  ws.mergeCells("A10:F10");
  setCell(ws, "A10", `Договор (заявка): № ${order.order_number}`);

  const headRow = 12;
  const headers = [
    "№ п/п",
    "Наименование работ (услуг)",
    "Ед. изм.",
    "Количество",
    "Цена за единицу, ₸",
    "Стоимость, ₸",
  ];
  headers.forEach((title, index) => {
    tableCell(ws, headRow, index + 1, title, { bold: true, align: "center" });
  });
  ws.getRow(headRow).height = 26;

  let row = headRow + 1;
  let total = 0;
  items.forEach((item, index) => {
    total += item.total_amount;
    tableCell(ws, row, 1, index + 1, { align: "center" });
    tableCell(ws, row, 2, item.product_name);
    tableCell(ws, row, 3, item.unit || "шт", { align: "center" });
    tableCell(ws, row, 4, item.qty, { align: "center" });
    tableCell(ws, row, 5, money(item.price), { align: "right", numFmt: NUM_FMT });
    tableCell(ws, row, 6, money(item.total_amount), { align: "right", numFmt: NUM_FMT });
    row++;
  });

  ws.mergeCells(`A${row}:E${row}`);
  tableCell(ws, row, 1, "Итого", { bold: true, align: "right" });
  tableCell(ws, row, 6, money(total), { bold: true, align: "right", numFmt: NUM_FMT });
  row += 2;

  ws.mergeCells(`A${row}:F${row}`);
  setCell(ws, `A${row}`, `Всего на сумму: ${amountInWordsKzt(total)}`, { wrap: true, italic: true });
  row++;
  ws.mergeCells(`A${row}:F${row}`);
  setCell(ws, `A${row}`, company.taxNote, { size: 9 });
  row++;
  ws.mergeCells(`A${row}:F${row}`);
  setCell(
    ws,
    `A${row}`,
    "Работы (услуги) выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам не имеет.",
    { wrap: true },
  );
  row += 3;

  setCell(ws, `A${row}`, "Исполнитель:", { bold: true });
  ws.mergeCells(`B${row}:C${row}`);
  setCell(ws, `B${row}`, `____________________ ${company.directorName}`);
  ws.mergeCells(`D${row}:F${row}`);
  setCell(ws, `D${row}`, "М.П.", { align: "right" });
  row += 2;
  setCell(ws, `A${row}`, "Заказчик:", { bold: true });
  ws.mergeCells(`B${row}:D${row}`);
  setCell(ws, `B${row}`, `____________________ ${order.customer_name} (${order.company_name})`, { wrap: true });
  ws.mergeCells(`E${row}:F${row}`);
  setCell(ws, `E${row}`, "М.П.", { align: "right" });

  if (company.isDemo) {
    ws.mergeCells("A4:F4");
    setCell(ws, "A4", "ДЕМО-ДОКУМЕНТ", { bold: true, align: "center", size: 11 });
  }

  return wb.xlsx.writeBuffer();
}
