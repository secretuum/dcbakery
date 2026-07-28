import "server-only";
import type { Order, OrderItem } from "@/src/types";
import { iikoProductId } from "@/src/data/iiko-product-map";
import { iikoRestoConfigured, importOutgoingInvoice, withIiko } from "@/src/lib/iiko-resto";

// Списание заказа сайта в iiko расходной накладной (при статусе «Доставляется»).
// Значения по умолчанию — из выгрузки iiko (можно переопределить env):
//   склад «DC Bakery Десерты и полуфабрикаты», контрагент «DC Пекарня B2B: …»,
//   счёт выручки 4.01, счёт расчётов 5.01.
// СТАТУС ДОКУМЕНТА по умолчанию NEW (черновик — НЕ трогает остаток, менеджер
// проводит в iikoOffice). Для реального авто-списания задать IIKO_DOC_STATUS=PROCESSED.

const DEFAULT_STORE_ID = "572ff137-0f56-43da-9ddf-0d6b5d0b7d97";
const DEFAULT_COUNTERAGENT_ID = "7156097c-4783-81ad-019b-454f7c691210";
const DEFAULT_REVENUE_CODE = "4.01";
const DEFAULT_ACCOUNT_TO_CODE = "5.01";

function docStatus(): "NEW" | "PROCESSED" {
  return process.env.IIKO_DOC_STATUS === "PROCESSED" ? "PROCESSED" : "NEW";
}

export type IikoExportResult = {
  ok: boolean;
  skipped?: "not_configured" | "no_mapped_items" | "auth_failed";
  error?: string;
  /** product_id позиций, которых нет в карте iiko (списаны не будут) */
  unmapped?: string[];
};

/**
 * Выгружает списание заказа в iiko. Никогда не бросает — только возвращает результат.
 * Идемпотентность верхнего уровня (один раз на заказ) обеспечивает вызывающий:
 * триггерит лишь на ПЕРЕХОД в «Доставляется».
 */
export async function exportOrderWriteoffToIiko(
  order: Order,
  items: OrderItem[],
): Promise<IikoExportResult> {
  if (!iikoRestoConfigured()) {
    return { ok: false, skipped: "not_configured" };
  }

  const storeId = process.env.IIKO_B2B_STORE_ID || DEFAULT_STORE_ID;
  const invItems: { productId: string; storeId: string; price: number; amount: number; sum: number }[] = [];
  const unmapped: string[] = [];

  for (const item of items) {
    const productId = iikoProductId(item.product_id);
    if (!productId) {
      unmapped.push(item.product_id);
      continue;
    }
    const amount = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    if (amount <= 0) continue;
    invItems.push({
      productId,
      storeId,
      price,
      amount,
      sum: Number(item.total_amount) || price * amount,
    });
  }

  if (invItems.length === 0) {
    return { ok: false, skipped: "no_mapped_items", unmapped };
  }

  try {
    const result = await withIiko((key) =>
      importOutgoingInvoice(key, {
        documentNumber: order.order_number,
        dateIncoming: new Date().toISOString(),
        status: docStatus(),
        storeId,
        counteragentId: process.env.IIKO_B2B_COUNTERAGENT_ID || DEFAULT_COUNTERAGENT_ID,
        revenueAccountCode: process.env.IIKO_REVENUE_ACCOUNT_CODE || DEFAULT_REVENUE_CODE,
        accountToCode: process.env.IIKO_ACCOUNT_TO_CODE || DEFAULT_ACCOUNT_TO_CODE,
        items: invItems,
      }),
    );

    if (!result) {
      return { ok: false, skipped: "auth_failed", unmapped: unmapped.length ? unmapped : undefined };
    }

    return result.ok
      ? { ok: true, unmapped: unmapped.length ? unmapped : undefined }
      : { ok: false, error: result.error, unmapped: unmapped.length ? unmapped : undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "iiko export failed", unmapped };
  }
}
