// Структурированные данные Schema.org (JSON-LD) для «богатых» сниппетов в поиске.
// Рендерится как <script type="application/ld+json"> — стандартный способ в Next.

import { serializeJsonLd } from "./jsonld-serialize";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Данные собираются на сервере, но НЕ из одних лишь наших полей: названия и
      // описания товаров приходят из админки и из загруженного прайса. Экранирование
      // «меньше» — в serializeJsonLd, там же объяснено, почему его мало не бывает.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
