import { NextResponse } from "next/server";
import { getIsSuperAdmin } from "@/src/lib/superadmin";

// Лёгкая проверка «я суперадмин?» для КЛИЕНТСКОГО редактора сайта (SiteEditProvider).
// B3: раньше статус читался в серверном layout через cookie и форсил динамику ВСЕХ
// публичных страниц. Теперь layout статичен, а редактор дочитывает статус здесь —
// только когда суперадмин включил режим правки (обычные посетители сюда не ходят).
// Проверка авторитетна (валидирует админ-cookie на сервере), поэтому клиентское
// состояние не влияет на безопасность: сохранение всё равно требует админ-авторизации.
export async function GET() {
  return NextResponse.json({ isSuperAdmin: await getIsSuperAdmin() });
}
