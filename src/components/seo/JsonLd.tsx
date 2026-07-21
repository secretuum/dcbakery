// Структурированные данные Schema.org (JSON-LD) для «богатых» сниппетов в поиске.
// Рендерится как <script type="application/ld+json"> — стандартный способ в Next.

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Данные формируются на сервере из наших же полей — не пользовательский ввод.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
