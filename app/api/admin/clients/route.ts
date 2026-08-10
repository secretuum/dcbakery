import { NextResponse } from "next/server";
import { isValidBin } from "@/src/lib/bin";
import { isValidKzMobile } from "@/src/lib/phone";
import { getWhatsAppChatIdFromPhone } from "@/src/lib/whatsapp";
import {
  fetchWhatsAppClientByChatId,
  saveWhatsAppClientProfile,
} from "@/src/lib/whatsapp-client-store";
import { ensureClientRecord } from "@/src/lib/account/ensure-client";
import { getCurrentAdminRole } from "@/src/lib/superadmin";

// Ручное создание клиента сотрудником (admin/manager) — БЕЗ OTP (стадия 2 фичи
// торгпредов, см. docs/feature-manager-access-plan.md). Доступ пускает proxy
// (белый список для роли manager); здесь — защита в глубину + логика создания,
// повторяющая обычную регистрацию (app/api/profile/register) минус OTP/пароль/сессия.

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  // Защита в глубину: маршрут и так закрыт proxy, но убеждаемся, что это сотрудник.
  if ((await getCurrentAdminRole()) === null) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const companyName = asString(raw.companyName);
  const phone = asString(raw.phone);
  const customerBin = asString(raw.customerBin);
  const customerName = asString(raw.customerName);
  const deliveryAddress = asString(raw.deliveryAddress);
  const accountantPhone = asString(raw.accountantPhone);
  const email = asString(raw.email).toLowerCase();

  if (!companyName) {
    return NextResponse.json({ error: "Укажите название компании" }, { status: 422 });
  }
  if (!isValidKzMobile(phone)) {
    return NextResponse.json(
      { error: "Введите корректный мобильный номер, например +7 705 123 45 67" },
      { status: 422 },
    );
  }
  if (customerBin && !isValidBin(customerBin)) {
    return NextResponse.json({ error: "БИН/ИИН указан неверно — проверьте 12 цифр" }, { status: 422 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Введите корректный email или оставьте пустым" }, { status: 422 });
  }

  const chatId = getWhatsAppChatIdFromPhone(phone);
  if (!chatId) {
    return NextResponse.json({ error: "Неверный номер телефона" }, { status: 422 });
  }

  // «С нуля»: если клиент с таким номером уже есть — не перетираем его данные.
  const existing = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
  if (existing) {
    return NextResponse.json({ error: "Клиент с этим номером уже есть.", chatId }, { status: 409 });
  }

  try {
    await saveWhatsAppClientProfile({
      chatId,
      customerPhone: phone,
      companyName,
      customerBin: customerBin || undefined,
      customerName: customerName || undefined,
      customerEmail: email || undefined,
      deliveryAddress: deliveryAddress || undefined,
      accountantPhone: accountantPhone || undefined,
      ...(deliveryAddress
        ? { addresses: [{ address: deliveryAddress }], primaryAddressIndex: 0 }
        : {}),
    });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить клиента. Попробуйте позже." }, { status: 500 });
  }

  // Биллинг-строка clients (credit_limit=0 ⇒ предоплата) — как при обычной регистрации.
  // Best-effort: не роняем создание профиля из-за биллинг-строки.
  await ensureClientRecord({ phone, companyName, email: email || null }).catch(() => null);

  return NextResponse.json({ ok: true, chatId });
}
