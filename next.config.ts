import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Хост публичного хранилища Supabase (фото товаров + картинки конструктора главной).
// Без этого next/image ОТКАЗЫВАЕТСЯ грузить удалённые URL — загруженные через админку
// фото (https://<ref>.supabase.co/storage/...) не отображаются, показывается заглушка.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

// ТОЛЬКО точный хост нашего проекта, взятый из NEXT_PUBLIC_SUPABASE_URL. Подходит и для
// обычного <ref>.supabase.co, и для кастомного домена — отдельная ветка им не нужна.
//
// НИКОГДА не возвращать сюда шаблон вида "*.supabase.co". Next сверяет hostname через
// picomatch (next/dist/shared/lib/match-remote-pattern.js), а "*" там — ЛЮБОЙ
// одноуровневый поддомен, то есть под шаблон подходит и <чужой-проект>.supabase.co.
// Эндпоинт /_next/image публичный: matcher middleware в proxy.ts исключает _next/, прав
// там никто не проверяет. С шаблоном любой желающий заводит собственный проект Supabase,
// кладёт туда файл и заставляет НАШ сервер скачать его и разобрать нативным декодером
// (libvips/libheif внутри sharp) — известный путь к RCE/DoS в оптимизаторе картинок,
// без аккаунта и без админки.
//
// Если переменной окружения нет — список остаётся ПУСТЫМ. Пустой список ломает только
// показ удалённых картинок, шаблон ломает сервер; молча подставлять шаблон нельзя.
const remotePatterns: RemotePattern[] = supabaseHost
  ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
  : [];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // B3: локаль как корневой сегмент [locale] → getLocale() читает её через
  // next/root-params вместо headers(), что снимает форс-динамику и открывает ISR.
  // Флага experimental.rootParams здесь БОЛЬШЕ НЕТ и добавлять его не нужно: с 16.3.x
  // next/root-params доступен по умолчанию, а из типов ExperimentalConfig свойство
  // убрано — с ним next build падает на проверке типов (TS2353). Механизм при этом
  // никуда не делся: сборка на 16.3.5 без флага даёт те же 256 статических страниц и
  // те же revalidate/expire, что и 16.2.9 с флагом.
  // cpus:2 — ограничение воркеров СБОРКИ: Next поднимает по воркеру на CPU-ядро, а на
  // билд-инстансе Render с ограниченной RAM это упирается в память (out-of-memory, exit
  // 134) на «Generating static pages». Влияет только на сборку, рантайм не трогает.
  experimental: {
    cpus: 2,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Долгий кэш оптимизированных дериватов — сервер не пережимает одну и ту же
    // картинку повторно (меньше нагрузка/egress). 31 день.
    minimumCacheTTL: 2678400,
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Наш фавикон — app/icon.png (отдаётся как /icon.png). Легаси-клиенты, старые
      // закладки и краулеры дёргают /favicon.ico напрямую → раньше был 404. Редиректим
      // на актуальную иконку (middleware сюда не заходит — matcher исключает файлы с точкой).
      { source: "/favicon.ico", destination: "/icon.png", permanent: true },
    ];
  },
};

export default nextConfig;
