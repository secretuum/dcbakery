// Принадлежит ли заказ клиенту сессии. Чистая функция (тестируемо). Телефоны
// сверяем только по НЕПУСТЫМ цифрам с обеих сторон — иначе пустая сессия («»)
// совпала бы с заказом, где телефон не-цифровой (digits("нет")===""). Email — обе
// стороны непустые, регистронезависимо.

function digits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export function orderMatchesSession(
  order: { customer_phone?: string | null; customer_email?: string | null },
  session: { phone?: string | null; email?: string | null },
): boolean {
  const sessionPhone = digits(session.phone);
  const orderPhone = digits(order.customer_phone);
  const ownsByPhone = sessionPhone.length > 0 && orderPhone.length > 0 && sessionPhone === orderPhone;

  const orderEmail = order.customer_email?.trim().toLowerCase() ?? "";
  const sessionEmail = session.email?.trim().toLowerCase() ?? "";
  const ownsByEmail = orderEmail.length > 0 && sessionEmail.length > 0 && orderEmail === sessionEmail;

  return ownsByPhone || ownsByEmail;
}
