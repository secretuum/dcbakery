// Разбор ответа Yandex Vision OCR в плоский текст. Чистая функция (тестируется отдельно
// от server-only yandex-ocr). Ответ recognizeText может прийти одним JSON или несколькими
// (по строке на страницу PDF), текст — в result.textAnnotation.fullText.

export function extractOcrText(bodyText: string): string {
  const pages: string[] = [];
  for (const line of bodyText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as { result?: { textAnnotation?: { fullText?: unknown } } };
      const full = obj?.result?.textAnnotation?.fullText;
      if (typeof full === "string" && full.trim()) pages.push(full.trim());
    } catch {
      // строка не JSON — пропускаем
    }
  }
  if (pages.length) return pages.join("\n").trim();
  // Фолбэк: весь body как один JSON.
  try {
    const obj = JSON.parse(bodyText) as { result?: { textAnnotation?: { fullText?: unknown } } };
    const full = obj?.result?.textAnnotation?.fullText;
    if (typeof full === "string") return full.trim();
  } catch {
    // не JSON целиком
  }
  return "";
}
