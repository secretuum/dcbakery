import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIdentifier } from "@/src/lib/rate-limit";
import { GeocodingAddressProvider } from "@/src/lib/whatsapp/orders/address/geocoder-provider";

// Проверка адреса доставки «в Алматы» для сайта (оформление заказа). ТОТ ЖЕ контур, что
// у WhatsApp-бота: эвристика по городу + бесплатный OSM-геокодер (см. geocoder-provider).
// Клиент вводит адрес на оформлении → фронт зовёт этот эндпоинт → outside_almaty блокирует.
// Антифрод-примечание: это серверная проверка адреса, но авторитетный отказ оформления
// сейчас на фронте (заказной роут /api/orders — запретная зона). Жёсткий серверный анфорс —
// отдельной правкой с явного согласия владельца.

const provider = new GeocodingAddressProvider();

export async function POST(request: Request) {
  const limited = await checkRateLimit({
    identifier: getRequestIdentifier(request),
    limit: 20,
    namespace: "geo:verify-address",
    windowMs: 5 * 60 * 1000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Слишком часто" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const address = typeof raw.address === "string" ? raw.address.trim() : "";
  if (address.length < 4) return NextResponse.json({ status: "uncertain", city: null });

  const res = await provider.validate(address).catch(() => null);
  if (!res) return NextResponse.json({ status: "uncertain", city: null });
  return NextResponse.json({ status: res.status, city: res.matchedCity ?? null });
}
