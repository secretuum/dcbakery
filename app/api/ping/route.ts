import { NextResponse } from "next/server";

// Лёгкий health-эндпоинт для keep-alive пингера. Держит инстанс Render «тёплым»
// (free-тариф засыпает после ~15 мин простоя). Никаких запросов к БД — только
// подтверждение, что сервер жив. Пинговать раз в 5–10 минут (UptimeRobot / cron).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, service: "dc-bakery" });
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}
