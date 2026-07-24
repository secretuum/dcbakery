// Нормализация и валидация казахстанского мобильного номера.
// Нормализуем к 11 цифрам с кодом страны 7 (ведущая 8 → 7), затем проверяем
// мобильный шаблон: 7 (страна) + 7 (мобильный блок) + [0,4,5,6,7] + 8 цифр.
// Это отсекает опечатки, короткие номера и городские коды (71x/72x/73x —
// не WhatsApp). Пример валидного: +7 705 123 45 67.

export function normalizeKzPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("8") ? `7${digits.slice(1)}` : digits;
}

export function isValidKzMobile(value: string): boolean {
  return /^77[04567]\d{8}$/.test(normalizeKzPhone(value));
}
