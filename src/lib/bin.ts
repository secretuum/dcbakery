// Валидация казахстанского БИН/ИИН (12 цифр) по контрольному разряду.
// Алгоритм (стандарт РК): контрольная цифра = Σ(цифра_i · вес1_i) mod 11.
// Если результат = 10 — пересчёт со вторым набором весов; если снова 10 —
// номер недействителен. Контрольная цифра должна совпасть с 12-й.

const W1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const W2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

export function normalizeBin(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidBin(value: string): boolean {
  const digits = normalizeBin(value);
  if (digits.length !== 12) return false;

  const nums = digits.split("").map(Number);
  const controlFrom = (weights: number[]) =>
    weights.reduce((sum, w, i) => sum + w * nums[i], 0) % 11;

  let control = controlFrom(W1);
  if (control === 10) control = controlFrom(W2);
  if (control === 10) return false;

  return control === nums[11];
}
