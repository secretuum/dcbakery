import "server-only";
import { cookies } from "next/headers";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/src/lib/client-session";
import { verifyDocumentToken } from "@/src/lib/document-token";

const onlyDigits = (p: string) => p.replace(/\D/g, "");

/**
 * Разрешён ли доступ к документам заказа (счёт/накладная/АВР). Пускаем, если:
 *  (1) валидный подписанный токен из ссылки (`?t=`) — путь для счетов в WhatsApp/Telegram и на
 *      странице оплаты, где у получателя нет сессии на сайте; ЛИБО
 *  (2) клиентская сессия принадлежит владельцу заказа (совпадает телефон) — путь из ЛК.
 * Иначе отказ (роут отдаёт 404 — не палим существование заказа). Раньше проверки не было вовсе
 * (IDOR: по угаданному/утёкшему UUID любой скачивал чужой счёт с БИН/адресом).
 *
 * `DOCUMENT_TOKEN_GRACE=1` — переходный режим: пускать без токена/сессии, только логируя. Нужен на
 * время, пока в WhatsApp/Telegram у клиентов живут СТАРЫЕ ссылки без `?t=`; после их устаревания
 * переменную убрать, чтобы включить жёсткую проверку.
 */
export async function canAccessOrderDocument(
  orderId: string,
  token: string | null | undefined,
  ownerPhone: string | null | undefined,
): Promise<boolean> {
  if (await verifyDocumentToken(orderId, token)) return true;

  const cookie = (await cookies()).get(CLIENT_SESSION_COOKIE)?.value;
  const session = cookie ? await verifyClientSession(cookie) : null;
  if (session?.phone && ownerPhone && onlyDigits(session.phone) === onlyDigits(ownerPhone)) {
    return true;
  }

  if (process.env.DOCUMENT_TOKEN_GRACE === "1") {
    console.warn("[doc-access] grace: доступ без токена/сессии разрешён (переходный период)", {
      orderId,
    });
    return true;
  }
  return false;
}

/** Добавить `?t=`/`&t=` к пути документа, сохранив уже имеющийся query. */
export function withDocToken(path: string, token: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}`;
}
