import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "@/next.config";

// dangerouslyAllowSVG открывает публичный /_next/image для SVG — активного контента,
// который отдаётся с нашего домена. Нам он не нужен (разбор 18.09 в docs/COORDINATION.md,
// перепроверен по коду 21.09): заглушки /products/*.svg перехватывает FallbackImage, иконки
// категорий идут обычным <img>, загрузка в админке SVG не пускает. Сторож, чтобы флаг
// не вернули «на всякий случай».
test("next/image не пускает SVG в оптимизатор", () => {
  const images = nextConfig.images ?? {};
  assert.notEqual(images.dangerouslyAllowSVG, true);
});
