import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { isValidBin, normalizeBinInput } from "@/src/lib/antifraud/company-check";
import { lookupCompanyByBin } from "@/src/lib/antifraud/company-registry";

// Клиентская live-проверка БИН на чекауте: по номеру возвращаем ТОЛЬКО официальное
// название компании из госреестра, чтобы клиент сверил, что не ошибся в номере.
// Фрод-профиль (флаги, долги, чёрные списки, город) клиенту НЕ отдаём — он остаётся
// менеджеру в карточке заказа (решение владельца: вердикт видит только менеджер).
// Ответ реестра кэшируется в lookupCompanyByBin (12ч), сам роут — с рейт-лимитом.

type VerifyBinResponse = {
  status: "ok" | "not_found" | "unavailable" | "invalid";
  name?: string | null;
};

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 20,
    namespace: "antifraud:verify-bin",
    windowMs: 5 * 60 * 1000,
  });

  if (!limited.allowed) {
    // Слишком часто — не наша забота пугать клиента, просто «недоступно».
    return NextResponse.json<VerifyBinResponse>(
      { status: "unavailable" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<VerifyBinResponse>({ status: "invalid" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const bin = normalizeBinInput(typeof raw.bin === "string" ? raw.bin : "");

  if (!isValidBin(bin)) {
    return NextResponse.json<VerifyBinResponse>({ status: "invalid" });
  }

  const record = await lookupCompanyByBin(bin);

  // Реестр не ответил/таймаут/битый ответ — молча «недоступно», клиента не пугаем.
  if (!record) {
    return NextResponse.json<VerifyBinResponse>({ status: "unavailable" });
  }

  if (!record.found) {
    return NextResponse.json<VerifyBinResponse>({ status: "not_found" });
  }

  return NextResponse.json<VerifyBinResponse>({
    status: "ok",
    name: record.titleRu ?? record.titleKz ?? null,
  });
}
